#include <stdio.h>
#include <sys/socket.h>
#include <netinet/in.h>
#include <stdbool.h>
#include <stdlib.h>
#include <unistd.h>
#include <pthread.h>
#include <string.h>
#include "mylib.h"

#define MAX_CLIENTS 100
#define BUFFER_SIZE 1024

struct Client
{
  int socketFD;
  char name[50];
  int room;
};

// Global clients array
struct Client *clients[MAX_CLIENTS];
pthread_mutex_t clientsMutex = PTHREAD_MUTEX_INITIALIZER;

// Broadcast to clients in the same room (except sender)
void broadcastMessage(int senderFD, char *message, ssize_t length, int room)
{
  pthread_mutex_lock(&clientsMutex);
  for (int i = 0; i < MAX_CLIENTS; i++)
  {
    if (clients[i] && clients[i]->socketFD != senderFD && clients[i]->room == room)
    {
      send(clients[i]->socketFD, message, length, 0);
    }
  }
  pthread_mutex_unlock(&clientsMutex);
}

void *handleClient(void *arg)
{
  struct Client *cli = (struct Client *)arg;
  char buffer[BUFFER_SIZE];

  // 1. Receive name
  int recvLen = recv(cli->socketFD, buffer, sizeof(buffer) - 1, 0);
  if (recvLen <= 0)
    goto CLEANUP;
  buffer[recvLen - 1] = '\0'; // remove newline
  strcpy(cli->name, buffer);

  // 2. Receive room number
  recvLen = recv(cli->socketFD, buffer, sizeof(buffer) - 1, 0);
  if (recvLen <= 0)
    goto CLEANUP;
  buffer[recvLen - 1] = '\0';
  cli->room = atoi(buffer);

  // Announce join to the room
  sprintf(buffer, "%s joined room %d\n", cli->name, cli->room);
  broadcastMessage(cli->socketFD, buffer, strlen(buffer), cli->room);

  // 3. Chat loop
  while (true)
  {
    recvLen = recv(cli->socketFD, buffer, sizeof(buffer) - 1, 0);
    if (recvLen <= 0)
      break;
    buffer[recvLen] = '\0';

    if (strcmp(buffer, "exit\n") == 0)
      break;

    char message[BUFFER_SIZE];
    sprintf(message, "[%s]: %s", cli->name, buffer);
    broadcastMessage(cli->socketFD, message, strlen(message), cli->room);
  }

CLEANUP:
  // Remove client
  close(cli->socketFD);
  pthread_mutex_lock(&clientsMutex);
  for (int i = 0; i < MAX_CLIENTS; i++)
  {
    if (clients[i] == cli)
    {
      clients[i] = NULL;
      break;
    }
  }
  pthread_mutex_unlock(&clientsMutex);

  // Announce leave
  sprintf(buffer, "%s left room %d\n", cli->name, cli->room);
  broadcastMessage(cli->socketFD, buffer, strlen(buffer), cli->room);

  free(cli);
  return NULL;
}

int main()
{
  int serverSocketFD = createTCPIPv4Socket();
  struct sockaddr_in *serverAddress = createIPv4Address("", 2000);

  int result = bind(serverSocketFD, (struct sockaddr *)serverAddress, sizeof(*serverAddress));
  if (result == 0)
    printf("Socket bound successfully on port 2000\n");
  else
  {
    perror("bind failed");
    return 1;
  }

  int listenResult = listen(serverSocketFD, 10);
  if (listenResult == 0)
    printf("Server is listening on port 2000...\n");
  else
  {
    perror("listen failed");
    return 1;
  }

  while (true)
  {
    struct sockaddr_in clientAddr;
    socklen_t clientLen = sizeof(clientAddr);
    int clientSocketFD = accept(serverSocketFD, (struct sockaddr *)&clientAddr, &clientLen);
    if (clientSocketFD < 0)
      continue;

    struct Client *cli = malloc(sizeof(struct Client));
    cli->socketFD = clientSocketFD;

    pthread_mutex_lock(&clientsMutex);
    for (int i = 0; i < MAX_CLIENTS; i++)
    {
      if (!clients[i])
      {
        clients[i] = cli;
        break;
      }
    }
    pthread_mutex_unlock(&clientsMutex);

    pthread_t id;
    pthread_create(&id, NULL, handleClient, cli);
    pthread_detach(id);
  }

  close(serverSocketFD);
  return 0;
}
