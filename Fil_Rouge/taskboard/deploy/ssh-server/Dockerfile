FROM debian:bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
    bash \
    ca-certificates \
    curl \
    docker.io \
    openssh-server \
    sudo \
    && rm -rf /var/lib/apt/lists/*

RUN useradd --create-home --shell /bin/bash deployer \
    && install -d -m 700 -o deployer -g deployer /home/deployer/.ssh \
    && printf 'deployer ALL=(ALL) NOPASSWD: /usr/bin/docker, /usr/bin/curl\n' > /etc/sudoers.d/deployer \
    && chmod 440 /etc/sudoers.d/deployer

COPY deploy/ssh-server/sshd_config /etc/ssh/sshd_config
COPY deploy/ssh-server/entrypoint.sh /usr/local/bin/entrypoint.sh
COPY deploy/ssh-server/deploy-taskboard.sh /usr/local/bin/deploy-taskboard.sh

RUN chmod 755 /usr/local/bin/entrypoint.sh /usr/local/bin/deploy-taskboard.sh \
    && mkdir -p /var/run/sshd

EXPOSE 22

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
