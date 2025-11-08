---
title: "Exploring Docker: Essential Commands, Best Practices, and Cool Images"
date: 2024-12-22T10:50:03-07:00
draft: false
tags:
  [
    "docker",
    "developer tools",
    "containers",
    "virtualization",
    "DevOps",
    "open-source tools",
  ]
cover:
  image: "posts/second/cover.png"
---

# Why Docker: Unlocking the Power of Containerization 🚀

Docker provides a fantastic way to quickly explore and use tools, services, or applications without the hassle of manual installation and dependency management. Here are some cool Docker images you can experiment with, along with instructions to get started.

---

## Basic Docker Commands to Know

Before diving into specific images, here are some essential Docker commands every user should know:

- `docker images` – List all images on your system.
- `docker ps -a` – Show all containers, including stopped ones.
- `docker volumes ls` – View all Docker volumes.
- `docker networks ls` – List all Docker networks.

---

## Cool Docker Images to Try Out

### 1. linuxserver/foldingathome

#### Overview

The Folding@Home project lets you contribute to disease research, including cancer, Alzheimer’s, and COVID-19, by donating unused computational power. This Docker image provides an easy way to join the network. You can set the account name and machine name in the CLI or do it later. If you have an NVIDIA GPU, you can enable it for better performance.

**Stats**:  
⭐ Over 1M+ pulls

#### How to Run

```bash
docker run -d \
  --name=foldingathome \
  -e PUID=1000 \
  -e PGID=1000 \
  -e TZ=Etc/UTC \
  -e ACCOUNT_TOKEN= \
  -e MACHINE_NAME= \
  -e CLI_ARGS= `# optional` \
  -p 7396:7396 `# optional` \
  -v /path/to/foldingathome/data:/config `# optional` \
  --restart unless-stopped \
  lscr.io/linuxserver/foldingathome:latest
```

Refer to the official docs [here](https://docs.linuxserver.io/images/docker-foldingathome/#docker-compose-recommended-click-here-for-more-info).

---

### 2. linuxserver/libreoffice

#### Overview

A containerized version of LibreOffice that allows you to edit documents directly from within a containerized environment.

**Stats**:  
⭐ Over 500K+ pulls

#### How to Run

```bash
docker run -d \
  --name=libreoffice \
  --security-opt seccomp=unconfined `# optional` \
  -e PUID=1000 \
  -e PGID=1000 \
  -e TZ=Etc/UTC \
  -p 3000:3000 \
  -p 3001:3001 \
  -v /path/to/config:/config `# optional` \
  --restart unless-stopped \
  lscr.io/linuxserver/libreoffice:latest
```

Refer to the official docs [here](https://hub.docker.com/r/linuxserver/libreoffice).

---

### 3. linuxserver/firefox

#### Overview

Run a full instance of Firefox in a container. Great for testing or maintaining a secure browsing environment.

**Stats**:  
⭐ Over 500K+ pulls

#### How to Run

```bash
docker run -d \
  --name=firefox \
  --security-opt seccomp=unconfined `# optional` \
  -e PUID=1000 \
  -e PGID=1000 \
  -e TZ=Etc/UTC \
  -e FIREFOX_CLI=https://www.linuxserver.io/ `# optional` \
  -p 3000:3000 \
  -p 3001:3001 \
  -v /path/to/config:/config `# optional` \
  --shm-size="1gb" \
  --restart unless-stopped \
  lscr.io/linuxserver/firefox:latest
```

Refer to the official docs [here](https://hub.docker.com/r/linuxserver/firefox).

---

### 4. corentinth/it-tools

#### Overview

A collection of handy developer tools available as a web app. Includes encoders, decoders, converters, and more, all with great UX.

**Stats**:  
⭐ Over 5M+ pulls

#### How to Run

```bash
docker run -d \
  --name=it-tools \
  -p 8080:80 \
  corentinth/it-tools
```

Refer to the official docs [here](https://hub.docker.com/r/corentinth/it-tools).

---

### 5. ollama/ollama

#### Overview

Run large language models with minimal setup. Perfect for experimenting with AI and machine learning tasks.

**Stats**:  
⭐ Over 5M+ pulls

#### How to Run

```bash
docker run -d \
  --name=ollama \
  -p 11434:11434 \
  -v ollama:/root/.ollama \
  ollama/ollama
```

Refer to the official docs [here](https://hub.docker.com/r/ollama/ollama).

---

### Best Practices

- Use `--rm` in the `docker run` command for temporary containers, e.g., running a Java file: `docker run --rm openjdk:latest java HelloWorld.java`

- Use Docker Scout Quickview to check for vulnerabilities in Docker images: `docker scout quickview <image-name>`

- Use Docker networks to isolate containers and allow communication between specific ones: `docker network create my_network`

---

## Docker Compose File for All Images

Here’s a `docker-compose.yml` to run all the above images together. It uses local ports starting from `3001` and demonstrates two isolated networks.

```yaml
version: "3.9"
networks:
  isolated_network1:
  isolated_network2:

services:
  foldingathome:
    image: lscr.io/linuxserver/foldingathome:latest
    container_name: foldingathome
    networks:
      - isolated_network1
    environment:
      PUID: 1000
      PGID: 1000
      TZ: Etc/UTC
      ACCOUNT_TOKEN: ""
      MACHINE_NAME: ""
    ports:
      - "3000:7396"

  libreoffice:
    image: lscr.io/linuxserver/libreoffice:latest
    container_name: libreoffice
    networks:
      - isolated_network2
    environment:
      PUID: 1000
      PGID: 1000
      TZ: Etc/UTC
    ports:
      - "3001:3001"
      - "3002:3002"

  firefox:
    image: lscr.io/linuxserver/firefox:latest
    container_name: firefox
    networks:
      - isolated_network1
    environment:
      PUID: 1000
      PGID: 1000
      TZ: Etc/UTC
    ports:
      - "3003:3003"
      - "3004:3004"

  it-tools:
    image: corentinth/it-tools
    container_name: it-tools
    networks:
      - isolated_network2
    ports:
      - "3005:80"

  ollama:
    image: ollama/ollama
    container_name: ollama
    networks:
      - isolated_network1
    volumes:
      - ollama:/root/.ollama
    ports:
      - "3006:11434"
```

To run all the services at once, use `docker-compose up -d`. This will start all containers in the background. You can access them in your browser using the defined ports. To stop and remove all the containers, use `docker-compose down`.

---

## Conclusion

These Docker images showcase the incredible range of use cases Docker supports—from contributing to scientific research to running AI models, secure browsing, and developer tools. Each of these is lightweight, easy to run, and can be explored with just a few commands.

Refer to Docker Desktop installation [here](https://www.docker.com/products/docker-desktop/). Stay tuned for more Docker image reviews and tutorials!
