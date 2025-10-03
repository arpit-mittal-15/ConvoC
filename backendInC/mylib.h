#ifndef MYLIB_H_
#define MYLIB_H_

#include <netinet/in.h> 

int createTCPIPv4Socket();
struct sockaddr_in* createIPv4Address(char *, int);

#endif 