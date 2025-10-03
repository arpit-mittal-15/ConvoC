#include <stdio.h>
#include <string.h>
#include <stdbool.h>
#include "mylib.h"

int main(){

  int socketFD = createTCPIPv4Socket();
  struct sockaddr_in *address = createIPv4Address("127.0.0.1", 2000);

  int result = connect(socketFD, (struct sockaddr*)address, sizeof *address);

  if(result == 0)
    printf("Connection was successful\n");
  else
    perror("not successful\n");

  
  char *line = NULL;
  size_t lineSize = 0;

  printf("type and we will send(type exit)...\n");

  while(true){
    ssize_t charCount = getline(&line, &lineSize, stdin);

    if(charCount > 0){
      if(strcmp(line, "exit\n") == 0)
        break;

        ssize_t amountWasSend = send(socketFD, line, charCount, 0);
    }
  }

  return 0;
}