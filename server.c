#include <stdio.h>
#include <sys/socket.h>
#include <netinet/in.h>
#include "mylib.h"

int main()
{

  int serverSocketFD = createTCPIPv4Socket();
  struct sockaddr_in *serverAddress = createIPv4Address("", 2000);

  // Cast to struct sockaddr* for bind
  int result = bind(serverSocketFD, (struct sockaddr *)serverAddress, sizeof(*serverAddress));

  if (result == 0)
    printf("socket was bound successfully\n");

  int listenResult = listen(serverSocketFD, 10);

  struct sockaddr_in clientAddress;
  socklen_t clientAddressSize = sizeof clientAddress; // use socklen_t, not int

  // Cast to struct sockaddr* for accept
  int clientSocketFD = accept(serverSocketFD, (struct sockaddr *)&clientAddress, &clientAddressSize);

  char buffer[1024] = {0};
  recv(clientSocketFD, buffer, sizeof(buffer), 0);

  printf("Response was %s\n", buffer);

  return 0;
}
