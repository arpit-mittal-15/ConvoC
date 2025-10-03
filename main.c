#include <stdio.h>
#include <string.h>
#include <stdbool.h>
#include <unistd.h>
#include <pthread.h>
#include <arpa/inet.h>
#include "mylib.h"

void *receiveMessages(void *arg)
{
  int sock = *(int *)arg;
  char buffer[1024];
  while (1)
  {
    int len = recv(sock, buffer, sizeof(buffer) - 1, 0);
    if (len <= 0)
      break;
    buffer[len] = '\0';
    printf("%s", buffer);
  }
  return NULL;
}

int main()
{
  int socketFD = createTCPIPv4Socket();
  struct sockaddr_in *address = createIPv4Address("127.0.0.1", 2000);

  if (connect(socketFD, (struct sockaddr *)address, sizeof(*address)) == 0)
    printf("Connected to server!\n");
  else
  {
    perror("Connection failed");
    return 1;
  }

  char *line = NULL;
  size_t lineSize = 0;

  // Send name
  printf("Enter your name: ");
  ssize_t charCount = getline(&line, &lineSize, stdin);
  send(socketFD, line, charCount, 0);

  // Send room
  printf("Enter room number: ");
  charCount = getline(&line, &lineSize, stdin);
  send(socketFD, line, charCount, 0);

  // Start receiving messages
  pthread_t recvThread;
  pthread_create(&recvThread, NULL, receiveMessages, &socketFD);

  // Chat loop
  while (true)
  {
    charCount = getline(&line, &lineSize, stdin);
    if (charCount > 0)
    {
      if (strcmp(line, "exit\n") == 0)
      {
        send(socketFD, line, charCount, 0);
        break;
      }
      send(socketFD, line, charCount, 0);
    }
  }

  close(socketFD);
  return 0;
}
