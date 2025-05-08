# Use a standard Debian base image (Bullseye is a good choice)
FROM debian:bullseye-slim

# --- TARGET ASTERISK VERSION 21 (LTS) - Using 21.2.0 ---
ARG ASTERISK_VERSION=21.2.0
# Check https://downloads.asterisk.org/pub/telephony/asterisk/releases/ for available point releases

ENV ASTERISK_VERSION=${ASTERISK_VERSION}
ENV DEBIAN_FRONTEND=noninteractive

# Install build dependencies, common utilities, and ffmpeg
# Ensure all essential build tools and libraries are listed here
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        build-essential \
        wget \
        curl \
        ca-certificates \
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
        # Minimal runtime libs that might be needed by PJSIP/Asterisk
        libssl1.1 \
        libxml2 \
        libsqlite3-0 \
        # Audio format libs (runtime)
        libsrtp2-1 \
        # *** ADD SRTP Development Package ***
        libsrtp2-dev \
        # Add ffmpeg
        ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Download and extract Asterisk source
WORKDIR /usr/src
RUN wget https://downloads.asterisk.org/pub/telephony/asterisk/releases/asterisk-${ASTERISK_VERSION}.tar.gz && \
    tar -xzf asterisk-${ASTERISK_VERSION}.tar.gz && \
    rm asterisk-${ASTERISK_VERSION}.tar.gz

# Change WORKDIR into the extracted source directory
WORKDIR /usr/src/asterisk-${ASTERISK_VERSION}

# --- REMOVED 'install_prereq' step ---
# The dependencies listed in the apt-get install above should be sufficient.

# Run configure script
# It should detect missing system PJSIP dev headers and configure for bundled PJSIP.
# It should now find the SRTP headers/libs we installed.
RUN ./configure --with-ssl --with-srtp

# --- Module Selection (Optional but Recommended) ---
# COPY menuselect.makeopts menuselect.makeopts
# --- End Module Selection ---

# Compile Asterisk
RUN make -j$(nproc)

# Install Asterisk
RUN make install

# Install basic config files and samples (optional)
RUN make config
# RUN make samples

# Create necessary directories and set permissions
WORKDIR /
RUN groupadd asterisk --gid 999 || true && \
    useradd -r -g asterisk --uid 999 -d /var/lib/asterisk -s /sbin/nologin asterisk || true && \
    mkdir -p /var/log/asterisk /var/lib/asterisk /var/run/asterisk /var/spool/asterisk /etc/asterisk /usr/lib/asterisk && \
    chown -R asterisk:asterisk /etc/asterisk /var/log/asterisk /var/lib/asterisk /var/run/asterisk /var/spool/asterisk /usr/lib/asterisk && \
    chmod -R 750 /var/log/asterisk /var/lib/asterisk /var/run/asterisk /var/spool/asterisk /usr/lib/asterisk /etc/asterisk

# Copy your custom configuration files
COPY configs/ari.conf /etc/asterisk/ari.conf
COPY configs/http.conf /etc/asterisk/http.conf
COPY configs/extensions.conf /etc/asterisk/extensions.conf
COPY configs/pjsip.conf /etc/asterisk/pjsip.conf
COPY configs/logger.conf /etc/asterisk/logger.conf
COPY configs/rtp.conf /etc/asterisk/rtp.conf
COPY configs/modules.conf /etc/asterisk/modules.conf
# Chown config files to asterisk user after copying
RUN chown asterisk:asterisk /etc/asterisk/*

# Copy entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
RUN sed -i 's/\r$//' /entrypoint.sh

# Define default Asterisk user
USER asterisk

# Set final WORKDIR if needed (optional, defaults to /usr/src/asterisk-VERSION from above)
# WORKDIR /var/lib/asterisk

# Default command
# CMD ["asterisk", "-f", "-U", "asterisk", "-G", "asterisk"]

# Use your custom entrypoint if defined
ENTRYPOINT ["/entrypoint.sh"]
