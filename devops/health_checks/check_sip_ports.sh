#!/bin/bash

HOST="sip.myphonefriend.com"
STATIC_IP="3.141.235.83"

# Ports to check
SIP_TCP_PORT=5061
SIP_UDP_PORT=5060
RTP_START=10000
RTP_END=10010 # Adjust if needed

echo "Checking DNS resolution for $HOST..."
nslookup $HOST

echo -e "\nChecking SIP TCP port..."
nc -vz -w 2 $HOST $SIP_TCP_PORT

echo -e "\nChecking SIP UDP port..."
echo -n | nc -u -w1 $HOST $SIP_UDP_PORT && echo "UDP 5060 reachable" || echo "UDP 5060 unreachable"

echo -e "\nChecking RTP UDP ports $RTP_START to $RTP_END..."
for port in $(seq $RTP_START $RTP_END); do
  echo -n | nc -u -w1 $STATIC_IP $port && echo "UDP $port reachable" || echo "UDP $port unreachable"
done
