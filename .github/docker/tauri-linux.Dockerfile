# Tauri 2 Linux 构建基础镜像：预装 Ubuntu 22.04 的 WebKitGTK 4.1、AppImage 与 Rust 工具链，省去每次 CI 安装 apt 依赖
FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive \
    RUSTUP_HOME=/usr/local/rustup \
    CARGO_HOME=/usr/local/cargo \
    APPIMAGE_EXTRACT_AND_RUN=1 \
    PATH=/usr/local/cargo/bin:$PATH

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        build-essential \
        ca-certificates \
        curl \
        desktop-file-utils \
        file \
        git \
        libayatana-appindicator3-dev \
        libfuse2 \
        libgtk-3-dev \
        librsvg2-dev \
        libssl-dev \
        libwebkit2gtk-4.1-dev \
        patchelf \
        pkg-config \
        squashfs-tools \
        tar \
        unzip \
        wget \
        xdg-utils \
        xz-utils \
    && rm -rf /var/lib/apt/lists/* \
    && curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \
        | sh -s -- -y --profile minimal --default-toolchain stable \
    && chmod -R a+w /usr/local/rustup /usr/local/cargo
