I remember figuring out the shortest routes to class first semester of college. The lowkey flex of "I know a quicker way" never saved much time, and yet it felt *fun* to explore campus through these mildly competitive treks.

I approach my computer the same way. The shortcuts, the key-binds, the new apps – it's rarely about saving time. It's about having *fun*.

Last week, I had a daily average screen time of **17 hrs**. I've been hooked since I was 6 y/o playing Facebook games on my mother's account. Though mildly concerning, it's safe to assume that I love computers and the internet. So, making the trek around my OS and the web a little more fun and flashy is always welcome.

Most of the applications I'll be talking about aren't necessary, but I think everyone has something to gain from rethinking how they use their computer.

Every week I'm tweaking something new – remapping keys, testing a new [*Sindre*](https://sindresorhus.com/) app, finding keybinds. The setup is never "done." Same as those campus routes – the exploration is the point.

## Core Principles

I follow a few basic principles:

1.  **Window Management:** you want to consistently keep everything in the same place (approximately).
2.  **Automating Workflows:** if you do an action a few times daily, you should look for a shortcut/automation for it.
3.  **Keyboard > Mouse:** 9 times out of 10, using your keyboard is faster than your trackpad/mouse.

### Window Management

I like to think of my computer as my bedroom. It doesn't have to be perfectly clean all the time, but I should always have L1 cache access to whatever I want. It's not about saving time, it's about efficiency: your brain shouldn't be interrupted hunting for apps.

You shouldn't need a mental map of where every app, tab, and file is either. Rather, you should have a framework that guides you to whatever you need. Your setup should facilitate your work – not the other way around. You shouldn't be the one babysitting windows and hunting for apps

For example, I have key-binds set as follows:

-   <kbd>⌥ + 1</kbd>: *[Helium](https://helium.computer/)* (browser)
-   <kbd>⌥ + 2</kbd>: *[Obsidian](https://obsidian.md/)* (notes)
-   <kbd>⌥ + 3</kbd>: Terminal w/ *[Neovim](https://neovim.io/)* booted (IDE)
-   <kbd>⌥ + 4</kbd>: *Finder*

Additionally, I have *[Yabai](https://github.com/koekeishiya/yabai)* set up, which automatically opens 8 spaces when I log into my computer and moves applications to the following:

-   `1`: Work *(Helium, Obsidian)*
-   `2`: Social *(iMessage, Discord)*
-   `3`: Music *(Spotify)*
-   `4-6`: N/A (Misc.)
-   `7`: To-do *([Godspeed](https://godspeedapp.com/))*
-   `8`: Logistics *(Calendar, Mail, Slack)* And I can switch to different spaces with <kbd>^ + X</kbd> where <kbd>X</kbd> is the # of the space.

![macOS Mission Control view showing multiple desktop spaces](/static/media/pasted-image-20251003215923.webp) *Snapshot of my Mac spaces, never knew they existed until 1 month after getting my laptop.*

This setup automatically clusters applications by "category" in a way that I've become used to. This allows me to access almost any application I'm interested in through quick key-binds. Though *Yabai* makes this a lot easier, it has a steep learning curve. You could achieve a similar result without it:

1.  Go to `Settings > General > Login Items & Extensions`
2.  Add all relevant applications that you access often so they open on boot up
3.  Every time you boot up your Macbook: hit <kbd>F3</kbd>, create necessary spaces, drag and drop your applications to each space
4.  Go to `Settings > Keyboard > Keyboard Shortcuts`
5.  Open `Mission Control > Mission Control`. You can then set up key-binds for `Switch to Desktop X`

Beyond organizing applications across spaces, you also want to manage how windows arrange within each space. A window tiling manager automatically positions your windows in a non-overlapping grid - instead of manually resizing and moving windows, it handles the layout for you. Though MacOS has basic window snapping if you right-click the full-screen button, I recommend [*Rectangle*](https://rectangleapp.com/) to add keyboard shortcuts for manual arrangement. If you come from Linux, you might know [*Hyprland*](https://github.com/hyprwm/Hyprland) or [*i3*](https://i3wm.org/), which are automatic tiling managers. *Yabai* is similar but integrates with macOS spaces - new windows slot into the grid automatically, and you navigate entirely via keyboard.<sup class="footnote-ref" id="fnref-1"><a href="#fn-1">1</a></sup>

<video aria-label="Screen recording of terminal windows being arranged side by side with the macOS window tiling controls." autoplay="" loop="" muted="" playsinline="" style="max-width: 100%" src="/static/media/clipboard-20251012-200207-953.mp4"></video>*MacOS's default window tiling manager*

### Automating Workflows

With how accessible tools like [*Lovable*](https://lovable.dev/) and [*Raycast*](https://www.raycast.com/) are, there is no excuse to get an automation up and running in <30 mins. From my experience, I believe this is the best use for vibe coding: simple internal tooling to automate redundant tasks.

For example, I've been using multiple sources for interview prep this cycle: Leetcode, Neetcode, InterviewDB, etc. To log my solutions in a centralized database, I've decided to create a repository where I keep them. I found the continuous copy-pasting followed by 3 git commands clunky, so I vibe coded [*solve-log*](https://solve-log.lovable.app/) in 5 prompts to automate this process.

Another example: I switched browsers to *Helium* partially because of their `!bangs` system. If you're unfamiliar, `!bangs` let you search specific sites directly from your address bar – type `!gh react` and you're searching GitHub for React, or `!w quantum mechanics` to jump straight to Wikipedia. Instead of opening a site, finding the search bar, and typing my query, I just type the bang and search term. It sounds minor, but when you're constantly jumping between documentation, tools, and resources, those saved clicks add up. The workflow becomes: think of what you need from the site/service > type it > you're there.

Reminder: automation is about reducing cognitive overhead, not just saving time. Every repetitive task requires you to remember the steps, execute them in order, and context switch between tools. Even if a workflow only takes 30 seconds, doing it 10x a day means 10 moments where your brain has to shift gears. Automation collapses these multi-step processes into single actions, letting you stay in flow. When you notice yourself doing the same thing repeatedly, that's your cue to automate it.

### Keyboard > Mouse

Key-binds are oftentimes faster to use than a mouse. Most people reading this essay average 70+ WPM, which is more than enough to make browsing with your keyboard much faster than with your mouse.

For example, I often find myself drowning in tabs, even without duplicates. So, instead of restricting myself to fewer tabs, I found out that you can search through chrome tabs. The key-bind is <kbd>⌘ + Shift + A</kbd>. I also found out you can click hyperlinks/buttons on a webpage without a mouse by (1) clicking <kbd>⌘ + F</kbd>, (2) search + focusing on the text, (3) clicking <kbd>Esc</kbd>, then (4) clicking <kbd>Enter</kbd>.

<video aria-label="Screen recording of using browser find to focus and open a page link without using the mouse." autoplay="" loop="" muted="" playsinline="" style="max-width: 100%" src="/static/media/clipboard-20251012-200117-481.mp4"></video>*Clicking hyperlinks/buttons without a mouse*

Another example: I share files often. I found the default flow jarring: download file > open *Finder* > click *Downloads* > drag + drop file > send. However, a quick search through *Raycast*'s extension store led me to the [*Downloads Manager*](https://www.raycast.com/thomas/downloads-manager) extension, which had a shortcut for Pasting latest download. Now, my flow feels way snappier: download a file > press <kbd>⌘ + ⌥ + V</kbd> > send.

In the same vein: I switched to *Neovim* after realizing I was constantly reaching for my mouse in *VS Code*. [Vim motions](https://www.barbarianmeetscoding.com/boost-your-coding-fu-with-vscode-and-vim/moving-blazingly-fast-with-the-core-vim-motions/) keep your hands on the keyboard for everything – navigation, editing, refactoring. Fair warning: the learning curve is brutal. It took me a few weeks of feeling significantly slower before muscle memory kicked in. It's the logical extreme of the keyboard-first principle, but fully worth it if you're willing to invest the time.

## My Stack

With these principles in mind, I've spent a good chunk of my time on the internet optimizing for them. Here is a catalog of different tools I've used and enjoyed extensively. I'm aiming to make this *as comprehensive as possible*, so consider this a buffet – tinker at your own discretion.

### P1

These are the applications that fundamentally changed how I interact with my computer. Each one directly supports at least two of my core principles and has become non-negotiable in my workflow. If you agree with this essay, you should try these.

<details>
<summary><em><a href="https://www.raycast.com/">Raycast:</a></em> Command palette + extension platform</summary>

Quick launcher for apps, clipboard history, tab search, calculations, workflows. Extensions turn GUI apps (e.g. Spotify) fully keyboard-driven.

Key extensions: your respective browser's extension (command-palette for tabs), [*Raycast AI*](https://www.raycast.com/core-features/ai), [*Calendar*](https://www.raycast.com/core-features/calendar), [*Spotify*](https://www.raycast.com/mattisssa/spotify-player), [*2FA Code Finder*](https://www.raycast.com/yuercl/imessage-2fa), [*Toothpick*](https://www.raycast.com/VladCuciureanu/toothpick) (bluetooth), [*Bitwarden*](https://raycast.com/jomifepe/bitwarden), [*iLovePDF*](https://www.raycast.com/mohamedk1/ilovepdf), and more.

First app I install on any Mac. No alternatives come close.
</details>

<details>
<summary><em><a href="https://github.com/koekeishiya/yabai">Yabai:</a></em> MacOS window tiling manager</summary>

Enforces grid-based window layouts, auto-arranges on open, space switching via key-binds.

Alternatives: [*Rectangle*](https://rectangleapp.com/)<sup class="footnote-ref" id="fnref-1"><a href="#fn-1">1</a></sup> (not quite a window tiling manager, but great step-up over defaults), [*Aerospace*](https://github.com/nikitabobko/AeroSpace) (better UX than Yabai, but clunkier performance since they're not using Mac spaces)
</details>

<details>
<summary><em><a href="https://obsidian.md/">Obsidian:</a></em> Markdown-based notes</summary>

Markdown makes it standardized and simple to write structured notes. Sync requires paid subscription, but worth it for stable vim writing experience.

Alternatives: *Apple Notes* (free sync, lightweight), [*Notion*](https://www.notion.so/) (bloated and unstandardized, but many love it)
</details>

<details>
<summary><em><a href="https://neovim.io/">Neovim</a> (<a href="https://www.lazyvim.org/">LazyVim</a>):</em> Keyboard-driven terminal-based IDE</summary>

Keyboard-driven coding with vim motions, no mouse needed. Extremely modular, definitely an investment if new to vim motions. [Primeagen's videos](https://www.youtube.com/watch?v=ZWWxwwUsPNw) convinced me to switch.

Alternatives: [*Athas*](https://athas.dev/) (tried the alpha, loved it), VSC-based IDEs w/ [*Vim*](https://marketplace.visualstudio.com/items?itemName=vscodevim.vim) extension
</details>

### P2

These applications aren't as transformative as P1, but they're reliable, well-designed tools that respect keyboard-first workflows and reduce friction in daily tasks. They won't revolutionize your setup, but they'll smooth out rough edges you didn't realize existed.

<details>
<summary><em><a href="https://helium.computer/">Helium:</a></em> Ungoogled-chromium fork with <code>!bang</code> search</summary>

Direct site search from address bar (`!gh` for GitHub, `!y` for YouTube, etc.). Focused on performance + privacy, won back some battery life.

Alternatives: [*Zen*](https://zen-browser.app/) (most stable *[Arc](https://arc.net/)* replacement, not a fan of Firefox engine), [*Ora*](https://www.orabrowser.com/) (alpha build on WebKit)
</details>

<details>
<summary><em><a href="https://godspeedapp.com/">Godspeed:</a></em> Keyboard-driven to-do list</summary>

Great iPhone widget + global hotkey for adding to-dos. Designed to be fully keyboard-driven. Very fast and lightweight.

Alternatives: Your note-taking app of choice, [*Todoist*](https://www.todoist.com/) (one of the best global hotkeys, loved how "p1", "due tod", etc. translated to metadata)
</details>

<details>
<summary><em>Apple Mail:</em> Native mail client</summary>

Lightweight, syncs my Gmail + Outlook emails well with OAuth2, and syncs between my Macbook + iPhone very well. Mostly keyboard-driven, great for inbox zero.

Alternatives: [*Superhuman*](https://superhuman.com/) (big fan of inbox zero-native design, but overkill for me), [*Thunderbird*](https://www.thunderbird.net/en-US/) (reminds me of Linux Mint days, great and simple), *Gmail*/[*Outlook*](https://www.microsoft.com/en-us/microsoft-365/outlook/outlook-for-mac) clients if all your emails can be contained in either
</details>

<details>
<summary><em>Apple Calendar:</em> Native calendar client</summary>

Much like with Apple Mail, I want sync between my iPhone and Mac with a lightweight app that is keyboard-driven – checks all the boxes. Raycast extension allows me to quickly add events with my keyboard.
</details>

<details>
<summary><em><a href="https://github.com/tmux/tmux/wiki">tmux:</a></em> Terminal multiplexer</summary>

Lets you run multiple sessions, detach and reattach to them, and manage multiple panes and windows within a single SSH or local terminal.
</details>

### P3

Smaller utilities and quality-of-life improvements. Each solves a specific annoyance or enables a niche workflow. Not essential, but the kind of thing where once you have it, going back feels wrong.

<details>
<summary><em><a href="https://ohmyz.sh/">Oh My Zsh:</a></em> Framework for managing zsh configuration</summary>

Comes with a lot of neat plugins (auto-suggestions, syntax highlighting). Alternative would be to install your own plugins and manage them yourself.
</details>

<details>
<summary><em><a href="https://github.com/ajeetdsouza/zoxide">Zoxide:</a></em> Smarter cd command</summary>

Remembers frequently-used directories so you can jump to them with partial matches. Type `z foo` instead of `cd ~/projects/foobar/src`. Works across all major shells, supports interactive selection with fzf.

**Alternatives:** [*autojump*](https://github.com/wting/autojump), [*z*](https://github.com/rupa/z) (original, but slower)
</details>

<details>
<summary><em><a href="https://lovable.dev/">Lovable:</a></em> Best no-brain vibe-coding tool</summary>

Handles frontend/backend, database set-up, and hosting. Great for creating quick internal tooling and automations.
</details>

<details>
<summary><em>Quality of Life:</em></summary>

<kbd>Caps Lock</kbd> takes up a lot of real estate on your keyboard for an obscure action. I suggest remapping it to either <kbd>Backspace</kbd> or <kbd>Ctrl</kbd> – I personally switch my <kbd>Left Ctrl</kbd> and <kbd>Caps Lock</kbd>. I used [*hidutils*](https://hidutil-generator.netlify.app/) for the keyboard remapping, but you may also use [*Karabiner*](https://karabiner-elements.pqrs.org/)

[*AltTab*](https://alt-tab-macos.netlify.app/): better <kbd>Alt + Tab</kbd> experience: window previews, custom triggers, blacklist apps

[*MiddleClick*](https://github.com/artginzburg/MiddleClick): emulate a scroll wheel click with 3 finger click

[*Hidden Bar*](https://github.com/dwarvesf/hidden): hide/show menu bar icons with a simple drag-and-drop interface, neat applet to reduce visual noise

[*BetterDisplay*](https://github.com/waydabber/BetterDisplay): non-Apple monitors have DPI issues, BetterDisplay fixes them

[*Pure Paste*](https://sindresorhus.com/pure-paste): paste pure, unformatted text by default

[*Command X*](https://sindresorhus.com/command-x): cut and paste files in *Finder*, surprised this doesn't come with MacOS by default
</details>

Like finding shortcuts across campus, optimizing my setup is never really "done." There's always another route to try, another workflow to smooth out. My computer's been my campus since I was 6, and I'm not done tinkering with shortcuts – it was always about having fun (and aura) above all else.

* * *

<section class="footnotes"><ol><li id="fn-1"><p>More on the difference between <em>Rectangle</em> and <em>Yabai</em>. <em>Rectangle</em> is a keyboard shortcut tool for manual window arrangement – you tell it "put this window on the left half" and it does. It's simple, reliable, and works for most people. <em>Yabai</em> is an automatic tiling manager that enforces a grid structure: it decides where windows go based on a binary space partitioning algorithm, and you navigate with keyboard commands. <em>Yabai</em> also lets you move applications between spaces via key-binds and requires partially disabling <code>System Integrity Protection</code>. If you're curious about tiling managers but not ready for the commitment, start with <em>Rectangle</em>. If you want your computer to automatically organize windows and you're comfortable tinkering, try <em>Yabai</em>.<a href="#fnref-1" class="footnote">↩</a></p></li></ol></section>
