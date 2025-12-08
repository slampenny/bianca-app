FROM public.ecr.aws/debian/debian:bullseye-slim

ARG ASTERISK_VERSION=21.2.0
ENV ASTERISK_VERSION=${ASTERISK_VERSION}
ENV DEBIAN_FRONTEND=noninteractive

# Install build dependencies and runtime dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        build-essential \
        wget \
        curl \
        nano \
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
        libcurl4-openssl-dev \
        ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src
RUN wget https://downloads.asterisk.org/pub/telephony/asterisk/releases/asterisk-${ASTERISK_VERSION}.tar.gz && \
    tar -xzf asterisk-${ASTERISK_VERSION}.tar.gz && \
    rm asterisk-${ASTERISK_VERSION}.tar.gz

WORKDIR /usr/src/asterisk-${ASTERISK_VERSION}

# 1. Configure Asterisk
RUN ./configure --with-ssl --with-srtp --with-jansson-bundled --with-pjproject-bundled --enable-shared

# 2. Create default module selection options
RUN make menuselect.makeopts

# 3. Ensure /etc/asterisk exists before make basic-pbx tries to write to it
RUN mkdir -p /etc/asterisk
RUN make basic-pbx 

# 4. Compile Asterisk (module selection influenced by menuselect.makeopts and basic-pbx)
RUN make -j$(nproc)

# 5. DIAGNOSTIC STEP: Check if the .so files were compiled in the build directory
RUN echo "Checking for compiled res_http_*.so files in res/ directory..." && \
    (ls -l res/res_http_*.so && echo "--- Found res_http_*.so files in res/ ---") || \
    (echo "--- No res_http_*.so files found in res/ after make ---" && exit 0)
RUN echo "Checking for compiled res_ari_*.so files in res/ directory..." && \
    (ls -l res/res_ari_*.so && echo "--- Found res_ari_*.so files in res/ ---") || \
    (echo "--- No res_ari_*.so files found in res/ after make ---" && exit 0)


# 6. Install Asterisk (binaries, modules, etc.)
RUN make install

# 7. DIAGNOSTIC STEP: Check if the .so files were installed
RUN echo "Checking for installed res_http_*.so files in /usr/lib/asterisk/modules/..." && \
    (ls -l /usr/lib/asterisk/modules/res_http_*.so && echo "--- Found res_http_*.so files in modules dir ---") || \
    (echo "--- No res_http_*.so files found in modules dir after make install ---" && exit 0)
RUN echo "Checking for installed res_ari_*.so files in /usr/lib/asterisk/modules/..." && \
    (ls -l /usr/lib/asterisk/modules/res_ari_*.so && echo "--- Found res_ari_*.so files in modules dir ---") || \
    (echo "--- No res_ari_*.so files found in modules dir after make install ---" && exit 0)


# 8. Update shared library cache
RUN ldconfig

# 9. Install default configuration files
RUN make config 

# 10. Optionally, install sample configuration files
RUN make samples

# 11. Create asterisk user/group and set up directories with correct permissions
RUN groupadd -g 999 asterisk || true && \
    useradd -u 999 -g asterisk -r -s /sbin/nologin -d /var/lib/asterisk asterisk || true && \
    mkdir -p \
        /var/lib/asterisk/moh \
        /var/lib/asterisk/sounds/en \
        /var/log/asterisk/cdr-csv \
        /var/spool/asterisk/voicemail \
        /var/run/asterisk \
        /usr/lib/asterisk/modules && \
    chown -R asterisk:asterisk /etc/asterisk && \
    chmod -R u=rwX,g=rX,o= /etc/asterisk && \
    chown -R asterisk:asterisk /var/lib/asterisk /var/log/asterisk /var/spool/asterisk /var/run/asterisk /usr/lib/asterisk && \
    chmod -R u=rwX,g=rX,o= /var/lib/asterisk /var/log/asterisk /var/spool/asterisk /var/run/asterisk && \
    chmod -R u=rwX,g=rX,o-rwx /usr/lib/asterisk/modules


# Pre-create specific log files if needed by Asterisk before it can chown them
RUN touch /var/log/asterisk/messages \
          /var/log/asterisk/full \
          /var/log/asterisk/queue_log && \
    chown asterisk:asterisk /var/log/asterisk/*

# Copy your custom config templates and entrypoint
COPY configs/*.template /etc/asterisk/
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh && sed -i 's/\r$//' /entrypoint.sh && \
    chown asterisk:asterisk /entrypoint.sh /etc/asterisk/*.template

# Set up healthcheck while still root (before USER asterisk)
# HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=3 \
#   CMD pgrep asterisk || exit 1

# Drop privileges to asterisk user for main execution
USER asterisk

ENTRYPOINT ["/entrypoint.sh"]
