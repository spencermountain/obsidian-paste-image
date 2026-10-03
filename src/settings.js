import { PluginSettingTab, Setting } from 'obsidian';

const DEFAULT_SETTINGS = { preferImages: false, appendSource: false, linkText: '' };

class PasteImageSettings extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    const { settings } = this.plugin;
    containerEl.empty();
    new Setting(containerEl)
      .setName('Prefer images on paste')
      .setDesc('Use image files before text or URLs on ordinary paste. Text-only pastes stay unchanged; use the command to download image URLs.')
      .addToggle(toggle => toggle.setValue(settings.preferImages).onChange(async value => {
        settings.preferImages = value;
        await this.plugin.saveData(settings);
      }));
    new Setting(containerEl)
      .setName('Include image source link')
      .setDesc('Add the source URL beneath pasted images when the clipboard contains one. Also applies to ordinary image pastes.')
      .addToggle(toggle => toggle.setValue(settings.appendSource).onChange(async value => {
        settings.appendSource = value;
        await this.plugin.saveData(settings);
      }));
    new Setting(containerEl)
      .setName('Source link text')
      .setDesc('Optional Markdown link label, such as “Image source”. Leave blank to show the URL.')
      .addText(text => text.setPlaceholder('Image source').setValue(settings.linkText).onChange(async value => {
        settings.linkText = value;
        await this.plugin.saveData(settings);
      }));
  }
}

export { DEFAULT_SETTINGS, PasteImageSettings };
