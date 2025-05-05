FROM andrius/asterisk:latest

RUN apk update && apk add \
    asterisk-sounds-en \
    asterisk-sounds-moh

# Copy configuration files
COPY configs/ari.conf /etc/asterisk/ari.conf
COPY configs/http.conf /etc/asterisk/http.conf
COPY configs/extensions.conf /etc/asterisk/extensions.conf
COPY configs/pjsip.conf /etc/asterisk/pjsip.conf
COPY configs/logger.conf /etc/asterisk/logger.conf
COPY configs/rtp.conf /etc/asterisk/rtp.conf

# Copy the entrypoint script and make it executable
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
# Fix any Windows line endings if they exist
RUN sed -i 's/\r$//' /entrypoint.sh

# Set the entrypoint
ENTRYPOINT ["/entrypoint.sh"]