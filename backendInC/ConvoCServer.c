#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <stdbool.h>
#include <pthread.h>
#include <sys/socket.h>
#include <netinet/in.h>
#include <arpa/inet.h>
#include <openssl/sha.h>
#include <openssl/bio.h>
#include <openssl/evp.h>

#define MAX_CLIENTS 100
#define BUFFER_SIZE 2048

struct Client
{
  int socketFD;
  char name[50];
  int room;
};

struct Client *clients[MAX_CLIENTS];
pthread_mutex_t clientsMutex = PTHREAD_MUTEX_INITIALIZER;

// Base64 encode utility
void base64Encode(const unsigned char *input, size_t len, char *output)
{
  BIO *bmem = BIO_new(BIO_s_mem());
  BIO *b64 = BIO_new(BIO_f_base64());
  b64 = BIO_push(b64, bmem);
  BIO_set_flags(b64, BIO_FLAGS_BASE64_NO_NL);
  BIO_write(b64, input, len);
  BIO_flush(b64);
  int outLen = BIO_read(bmem, output, 1024);
  output[outLen] = '\0';
  BIO_free_all(b64);
}

// Send WebSocket text frame
void sendWebSocketMessage(int clientFD, const char *message)
{
  size_t len = strlen(message);
  unsigned char header[10];
  int headerSize = 0;

  header[0] = 0x81; // FIN + text frame
  if (len <= 125)
  {
    header[1] = len;
    headerSize = 2;
  }
  else if (len <= 65535)
  {
    header[1] = 126;
    header[2] = (len >> 8) & 0xFF;
    header[3] = len & 0xFF;
    headerSize = 4;
  }
  else
  {
    header[1] = 127;
    for (int i = 0; i < 8; i++)
      header[2 + i] = (len >> (56 - i * 8)) & 0xFF;
    headerSize = 10;
  }

  send(clientFD, header, headerSize, 0);
  send(clientFD, message, len, 0);
}

// Broadcast message to clients in the same room
void broadcastMessage(struct Client *sender, const char *message)
{
  pthread_mutex_lock(&clientsMutex);
  for (int i = 0; i < MAX_CLIENTS; i++)
  {
    if (clients[i] && clients[i] != sender && clients[i]->room == sender->room)
    {
      sendWebSocketMessage(clients[i]->socketFD, message);
    }
  }
  pthread_mutex_unlock(&clientsMutex);
}

// Decode WebSocket frame
void decodeWebSocketFrame(int clientFD, char *buffer, int *outLen)
{
  unsigned char header[2];
  int n = recv(clientFD, header, 2, 0);
  if (n <= 0)
  {
    *outLen = 0;
    return;
  }

  int payloadLen = header[1] & 0x7F;
  int maskOffset = 2;
  if (payloadLen == 126)
  {
    unsigned char ext[2];
    recv(clientFD, ext, 2, 0);
    payloadLen = (ext[0] << 8) | ext[1];
    maskOffset += 2;
  }
  else if (payloadLen == 127)
  {
    unsigned char ext[8];
    recv(clientFD, ext, 8, 0);
    payloadLen = 0;
    for (int i = 0; i < 8; i++)
      payloadLen = (payloadLen << 8) | ext[i];
    maskOffset += 8;
  }

  unsigned char mask[4];
  recv(clientFD, mask, 4, 0);

  unsigned char data[payloadLen];
  int received = 0;
  while (received < payloadLen)
  {
    int r = recv(clientFD, data + received, payloadLen - received, 0);
    if (r <= 0)
      break;
    received += r;
  }

  for (int i = 0; i < payloadLen; i++)
  {
    buffer[i] = data[i] ^ mask[i % 4];
  }
  buffer[payloadLen] = '\0';
  *outLen = payloadLen;
}

// Perform WebSocket handshake
void performWebSocketHandshake(int clientFD, char *buffer)
{
  char *keyHeader = strstr(buffer, "Sec-WebSocket-Key: ");
  if (!keyHeader)
    return;
  keyHeader += strlen("Sec-WebSocket-Key: ");
  char *keyEnd = strstr(keyHeader, "\r\n");
  char key[256];
  strncpy(key, keyHeader, keyEnd - keyHeader);
  key[keyEnd - keyHeader] = '\0';

  char concatKey[256];
  sprintf(concatKey, "%s%s", key, "258EAFA5-E914-47DA-95CA-C5AB0DC85B11");

  unsigned char sha1Hash[SHA_DIGEST_LENGTH];
  SHA1((unsigned char *)concatKey, strlen(concatKey), sha1Hash);

  char acceptKey[256];
  base64Encode(sha1Hash, SHA_DIGEST_LENGTH, acceptKey);

  char response[512];
  sprintf(response,
          "HTTP/1.1 101 Switching Protocols\r\n"
          "Upgrade: websocket\r\n"
          "Connection: Upgrade\r\n"
          "Sec-WebSocket-Accept: %s\r\n\r\n",
          acceptKey);

  send(clientFD, response, strlen(response), 0);
}

// Handle individual client
void *handleClient(void *arg)
{
  struct Client *cli = (struct Client *)arg;
  char buffer[BUFFER_SIZE];
  int n;

  // 1. Handshake
  n = recv(cli->socketFD, buffer, sizeof(buffer) - 1, 0);
  if (n <= 0)
    goto CLEANUP;
  buffer[n] = '\0';
  performWebSocketHandshake(cli->socketFD, buffer);

  // 2. Receive join JSON immediately
  decodeWebSocketFrame(cli->socketFD, buffer, &n);
  if (n <= 0)
    goto CLEANUP;

  // Expect: {"type":"join","name":"xxx","room":"1"}
  sscanf(buffer, "{\"type\":\"join\",\"name\":\"%[^\"]\",\"room\":\"%d\"}", cli->name, &cli->room);

  // 3. Broadcast join announcement immediately
  sprintf(buffer, "{\"type\":\"join\",\"name\":\"%s\",\"room\":\"%d\"} joined room %d\n", cli->name, cli->room, cli->room);
  broadcastMessage(cli, buffer);

  // 4. Chat loop
  while (true)
  {
    decodeWebSocketFrame(cli->socketFD, buffer, &n);
    if (n <= 0)
      break;

    char message[BUFFER_SIZE];
    sprintf(message, "[%s]: %s", cli->name, buffer);
    broadcastMessage(cli, message);
  }

CLEANUP:
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

  sprintf(buffer, "%s left room %d\n", cli->name, cli->room);
  broadcastMessage(cli, buffer);
  free(cli);
  return NULL;
}

int main()
{
  int serverSocket = socket(AF_INET, SOCK_STREAM, 0);
  struct sockaddr_in addr;
  addr.sin_family = AF_INET;
  addr.sin_port = htons(2000);
  addr.sin_addr.s_addr = INADDR_ANY;

  if (bind(serverSocket, (struct sockaddr *)&addr, sizeof(addr)) < 0)
  {
    perror("bind failed");
    return 1;
  }
  printf("Socket bound successfully on port 2000\n");

  listen(serverSocket, 10);
  printf("Server listening...\n");

  while (1)
  {
    struct sockaddr_in clientAddr;
    socklen_t clientLen = sizeof(clientAddr);
    int clientFD = accept(serverSocket, (struct sockaddr *)&clientAddr, &clientLen);
    if (clientFD < 0)
      continue;

    struct Client *cli = malloc(sizeof(struct Client));
    cli->socketFD = clientFD;

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

  close(serverSocket);
  return 0;
}
