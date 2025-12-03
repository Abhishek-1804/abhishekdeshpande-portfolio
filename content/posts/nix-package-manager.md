---
title: "Why Nix is Awesome!"
date: 2024-12-02T06:14:57-07:00
draft: false
tags:
  [
    "nix",
    "developer tools",
    "system configuration",
    "reproducible builds",
    "dev setup",
  ]
---

```
        *           *           *
      *   *       *   *       *   *
     *     *     *     *     *     *
      *   *       *   *       *   *
        *    ❄    *    ❄    *    ❄
       *   *       *   *       *   *
      *     *     *     *     *     *
       *   *       *   *       *   *
         *           *           *

    NIX: Reproducible, Declarative, Pure
```

# The Universal Package Manager 🌟

Nix is a powerful tool designed to revolutionize package management and system configuration. With its declarative approach, robust reproducibility, and ability to handle complex dependency trees, Nix has gained a reputation as one of the most innovative tools for developers, DevOps professionals, and software enthusiasts alike.

## Introduction to Nix

Nix is an advanced package manager that takes a **declarative and reproducible approach** to managing software. Unlike traditional package managers, Nix ensures that your system remains consistent and isolated, making it easier to reproduce builds across different environments. However, Nix comes with a steep learning curve, requiring time and effort to fully grasp its concepts and capabilities, particularly for those new to declarative configurations and functional programming paradigms.

## A Brief History

Nix was created in 2003 by Eelco Dolstra as part of his PhD thesis. The goal was to solve common issues with traditional package managers, such as dependency conflicts (the "dependency hell") and lack of reproducibility. Over the years, Nix has evolved into a versatile ecosystem, including tools like **NixOS** (an operating system built on Nix), **home-manager** (for managing user configurations), and **nix-darwin** (for macOS integration).

## Why Nix is Revolutionary

### Reproducible Builds

Nix ensures that every build is reproducible by storing packages in isolated paths and using cryptographic hashes for dependencies. This means your software will behave the same across machines and environments.

### Declarative Configurations

With Nix, you can define your entire system configuration in a single file. This simplifies managing dependencies and makes it easy to share or version-control your setup.

### Isolated Environments

Nix allows you to create isolated development environments where each project can have its own dependencies without affecting the global system.

### Cross-Language Package Management

Nix supports a wide variety of programming languages, from Python and JavaScript to Rust and Go, making it a universal package manager.

## Getting Started with Nix

### Linux Installation and Setting Up Nix

#### Step 1: Install Nix

1. Update system packages:

```bash
 sudo apt update && sudo apt upgrade -y
```

2. Install Nix:

```bash
 sh <(curl -L https://nixos.org/nix/install) --daemon
```

3. Configure Nix for experimental features (flakes):

```bash
 mkdir -p ~/.config/nix
 echo "experimental-features = nix-command flakes" >> ~/.config/nix/nix.conf
```

4. Restart the Nix daemon and reboot:

```bash
 sudo systemctl restart nix-daemon
 sudo reboot
```

---

#### Install Nix Flakes and Home Manager

##### Step 1: Initialize the Flake File

1. Create a new directory to hold your configuration files:

```bash
 mkdir -p ~/dotfiles/{linux,darwin,shared/modules/services}
 cd ~/dotfiles/linux
```

2. Initialize a flake.nix template in the current directory if you don't have an existing config:

```bash
 nix flake init -t github:nix-community/home-manager
```

---

##### Step 2: Install Home Manager

1. For an **existing configuration**, use:

```bash
 nix run home-manager/master -- init --switch /path/to/flake#username
```

Replace `/path/to/flake#username` with the full path to your flake.nix file and your system's username.

2. For a **new configuration**, use:

```bash
 nix run home-manager/master -- init --switch
```

This creates a basic home.nix template file.

---

##### Step 3: Update Configuration Files

1. Open the flake.nix and home.nix files.
2. Replace placeholders (e.g., username) with your actual username.
3. Save and exit the files.
4. Run `home-manager switch --flake ~/dotfiles/nix/linux#username -b backup` to apply changes

---

##### Step 4: Finalize Installation

1. Restart the Nix daemon:

```bash
 sudo systemctl restart nix-daemon
```

2. Reboot the system:

```bash
 sudo reboot
```

3. If Zsh is not installed as the default shell, set it up:
   - For root users:

   ```bash
    chsh -s $(which zsh)
   ```

   - For added users:

   ```bash
    sudo sh -c 'echo "/home/username/.nix-profile/bin/zsh" >> /etc/shells'
    chsh -s /home/username/.nix-profile/bin/zsh
   ```

   Replace username with your actual system username.

4. Use Home Manager to apply the configurations:

```bash
 home-manager switch --flake ~/dotfiles/nix/linux#root -b backup
```

Run this command every time you rebuild your system configuration.

---

### Example File Structure {#example-file-structure}

Here’s a suggested file structure for managing configurations:

![nix file structure](/posts/first/nix-file-structure.png)

**Key Points**:

- `darwin` and `linux` are platform-specific configurations.
- `shared` contains reusable modules and configurations for tools like Tmux, Neovim, and Starship.

---

### macOS Installation

1. Install Nix:

   ```bash
   sh <(curl -L https://nixos.org/nix/install)
   ```

   This installs the Nix package manager, enabling you to use its declarative and reproducible system for managing dependencies.

2. Install nix-darwin:

   ```bash
   nix run nix-darwin --extra-experimental-features "nix-command flakes" -- switch --flake ~/location-of-flake
   ```

   **Explanation**:
   - The above command installs `nix-darwin`, a tool specifically designed for macOS systems that extends Nix capabilities to manage macOS-specific configurations.
   - `nix-darwin` provides the `darwin-rebuild` utility, which allows you to build, switch, and manage your macOS configurations defined in your flake file.

3. Example Workflow with `darwin-rebuild`:
   - After setting up your configuration in `flake.nix` and `home.nix`, you can use the following commands to manage your macOS system:
     - Build and apply configurations:

       ```bash
       darwin-rebuild switch --flake ~/location-of-flake
       ```

     - Build configurations without applying:

       ```bash
       darwin-rebuild build --flake ~/location-of-flake
       ```

     - Rollback to the previous configuration:

       ```bash
       darwin-rebuild rollback
       ```

   - The configurations can include macOS-specific settings, system preferences, and installed packages.

---

### Useful References

- Nix Official Installation: <https://nixos.org/download>
- nix-darwin GitHub: <https://github.com/LnL7/nix-darwin>
- home-manager: <https://nix-community.github.io/home-manager/>

### Tips

- Use `nix-collect-garbage -d` to clean up unused packages
- Find flake and home.nix templates online

## Conclusion

Nix offers a powerful, reproducible approach to package management and system configuration. While it has a learning curve, the benefits of declarative, isolated environments make it a compelling choice for developers and system administrators.
