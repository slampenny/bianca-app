FROM debian:bullseye-slim

ARG ASTERISK_VERSION=21.2.0
ENV ASTERISK_VERSION=${ASTERISK_VERSION}
ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        build-essential \
        wget \
        curl \
        ca-certificates \
        gettext \
        netcat \
        libedit-dev \
        libjansson-dev \
        libsqlite3-dev \
        libssl-dev \
        libxml2-dev \
        uuid-dev \
        libtool \
        autoconf \
        automake \
        pkg-config \
        subversion \
        git \
        libssl1.1 \
        libxml2 \
        libsqlite3-0 \
        libsrtp2-1 \
        libsrtp2-dev \
        ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src
RUN wget https://downloads.asterisk.org/pub/telephony/asterisk/releases/asterisk-${ASTERISK_VERSION}.tar.gz && \
    tar -xzf asterisk-${ASTERISK_VERSION}.tar.gz && \
    rm asterisk-${ASTERISK_VERSION}.tar.gz

WORKDIR /usr/src/asterisk-${ASTERISK_VERSION}
RUN ./configure --with-ssl --with-srtp
RUN make -j$(nproc)
RUN make install
RUN make config

# Create asterisk user and fix permissions
RUN groupadd -g 999 asterisk || true && \
    useradd -u 999 -g asterisk -r -s /sbin/nologin -d /var/lib/asterisk asterisk || true && \
    mkdir -p /etc/asterisk /var/lib/asterisk /var/log/asterisk /var/spool/asterisk /var/run/asterisk /usr/lib/asterisk && \
    chmod -R 750 /etc/asterisk /var/lib/asterisk /var/log/asterisk /var/spool/asterisk /var/run/asterisk /usr/lib/asterisk && \
    chown -R asterisk:asterisk /etc/asterisk /var/lib/asterisk /var/log/asterisk /var/spool/asterisk /var/run/asterisk /usr/lib/asterisk

# Pre-create log files and subdirs with correct ownership
RUN mkdir -p /var/log/asterisk/cdr-csv && \
    touch /var/log/asterisk/queue_log && \
    chown -R asterisk:asterisk /var/log/asterisk /var/log/asterisk/*

# Copy configs and entrypoint
COPY configs/*.template /etc/asterisk/
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh && sed -i 's/\r$//' /entrypoint.sh && \
    chown asterisk:asterisk /entrypoint.sh /etc/asterisk/*.template

# Set up healthcheck while still root
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD su -s /bin/sh -c "/usr/sbin/asterisk -rx 'core show uptime' | grep 'System uptime'" asterisk || exit 1


# Drop privileges to asterisk user for main execution
USER asterisk

ENTRYPOINT ["/entrypoint.sh"]
