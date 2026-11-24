# Website Portfolio

This is the source code for my personal portfolio website, built with [Hugo](https://gohugo.io/) and the [PaperMod](https://github.com/adityatelange/hugo-PaperMod) theme.

## What is Hugo?

Hugo is a fast and modern static site generator written in Go. It takes content files (like Markdown) and templates and renders them into a complete HTML website. Static sites are fast, secure, and easy to deploy.

## Personal Customization

You can clone this repository to use as a template for your own portfolio.

1.  **Clone the repository:**
    This project uses a git submodule for the theme. To clone it correctly, use the `--recurse-submodules` flag:
    ```bash
    git clone --recurse-submodules https://github.com/abhishekdeshpande/abhishekdeshpande_portfolio.git
    ```
    If you've already cloned it without the flag, you can initialize the submodules with:
    ```bash
    git submodule update --init --recursive
    ```

2.  **Install Hugo:**
    You'll need to have Hugo installed on your local machine. You can find installation instructions for your operating system in the [official Hugo documentation](https://gohugo.io/getting-started/installing/).

3.  **Run the development server:**
    To see your changes live, run the following command from the root of the project:
    ```bash
    hugo server
    ```
    This will start a local server, usually at `http://localhost:1313/`.

4.  **Customize:**
    -   Content is located in the `content/` directory. You can edit the markdown files there to change the text.
    -   Configuration is in `hugo.yaml`. You can change the title, author, and other site-wide settings here.
    -   The theme can be customized by overriding templates in the `layouts/` directory.

## Keeping Hugo and the Theme Updated

### Updating Hugo

Hugo is a single binary. The update process depends on how you installed it. For example, if you used Homebrew on macOS, you can run:

```bash
brew upgrade hugo
```

Refer to the [official Hugo installation guide](https.gohugo.io/getting-started/installing/) for instructions specific to your system.

### Updating the Theme

The PaperMod theme is included as a git submodule. To update the theme to the latest version, run the following commands:

```bash
git submodule update --remote --merge
```

This will fetch the latest changes from the remote theme repository and merge them into your local submodule.

## Deployment

This website is hosted on GitHub Pages. The deployment is automated via a GitHub Actions workflow defined in `.github/workflows/hugo.yaml`.

**Important:** To ensure the website builds and deploys correctly, you must keep the Hugo version specified in the `.github/workflows/hugo.yaml` file consistent with your local development environment. If you upgrade Hugo locally, you must also update it in the workflow file.