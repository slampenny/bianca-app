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

WORKDIR /
RUN groupadd asterisk --gid 999 || true && \
    useradd -r -g asterisk --uid 999 -d /var/lib/asterisk -s /sbin/nologin asterisk || true && \
    mkdir -p /var/log/asterisk /var/lib/asterisk /var/run/asterisk /var/spool/asterisk /etc/asterisk /usr/lib/asterisk && \
    chown -R asterisk:asterisk /etc/asterisk /var/log/asterisk /var/lib/asterisk /var/run/asterisk /var/spool/asterisk /usr/lib/asterisk && \
    chmod -R 750 /var/log/asterisk /var/lib/asterisk /var/run/asterisk /var/spool/asterisk /usr/lib/asterisk /etc/asterisk

COPY configs/*.template /etc/asterisk/
RUN chown asterisk:asterisk /etc/asterisk/*.template
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh && sed -i 's/\r$//' /entrypoint.sh

# Fix permissions BEFORE switching users
RUN mkdir -p /var/log/asterisk/cdr-csv && \
    chown -R asterisk:asterisk \
        /etc/asterisk \
        /var/lib/asterisk \
        /var/log/asterisk \
        /var/spool/asterisk \
        /usr/lib/asterisk

USER asterisk

ENTRYPOINT ["/entrypoint.sh"]
