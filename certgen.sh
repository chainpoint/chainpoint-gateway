#!/usr/bin/env bash

# This script will generate a self-signed certificate for simple
# use with a Chainpoint Node. It will be valid for the IP Address
# provided as the first argument to the script as well as for
# common development addresses.
#
# It will output the certificate and key files in PEM form
# as well as a human readable '.info' that you can examine.

: ${1?"Usage: $0 IP_ADDRESS"}
#  Script exits here if command-line parameter absent,
#+ with following error message.
#    certgen.sh: 1: Usage: certgen.sh IP_ADDRESS

IP_ADDRESS=$1

# Certificate lifetime (10 years)
DAYS=3650

# A blank passphrase
PASSPHRASE=""

# Filename of generated openssl config file
CONFIG_FILE="certgen.cnf"

cat > $CONFIG_FILE <<-EOF
[req]
distinguished_name = req_distinguished_name
x509_extensions = v3_req
prompt = no
default_md = sha256

[req_distinguished_name]
C = US
ST = California
L = San Francisco
O = Self-Signed
CN = $IP_ADDRESS

[v3_req]
keyUsage = critical, digitalSignature, keyAgreement
extendedKeyUsage = serverAuth
subjectAltName = @alt_names

[alt_names]
DNS.1 = $IP_ADDRESS
DNS.2 = localhost
DNS.3 = localhost.localdomain
DNS.4 = 127.0.0.1
DNS.5 = ::1

IP.1 = $IP_ADDRESS
IP.2 = 127.0.0.1
IP.3 = ::1
EOF

# The file name can be anything
#FILE_NAME="$IP_ADDRESS"
FILE_NAME="cert"

# Remove previous cert files
[ -f ./cert.key ] && \
  chmod 770 $FILE_NAME.* && \
  rm $FILE_NAME.* && \
  echo 'Old TLS cert files removed' || true

echo "Generating certificate for IP Address : $IP_ADDRESS"

# Generate our Private Key, CSR and Certificate
# Use SHA-2 as SHA-1 is unsupported from Jan 1, 2017
openssl req -new -x509 -newkey rsa:4096 -sha256 -nodes -keyout "$FILE_NAME.key" -days $DAYS -out "$FILE_NAME.crt" -passin pass:$PASSPHRASE -config "$CONFIG_FILE"

# Store the human readable details of the generated crt in *.info file
openssl x509 -noout -fingerprint -text < "$FILE_NAME.crt" > "$FILE_NAME.info"

# Protect the key
chmod 444 "$FILE_NAME.key"
