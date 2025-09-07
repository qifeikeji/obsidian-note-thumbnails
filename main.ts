import {App, Plugin, PluginSettingTab, Setting, TFile} from 'obsidian';
import {addCardThumbnails} from "./utils";

export interface ExtraMarginSettings {
	top?: number;
	right?: number;
	bottom?: number;
	left?: number;
}

interface MyPluginSettings {
	size: number;
	borderRadius: number;
	extraMargin: ExtraMarginSettings;
	enableRealTimeUpdate: boolean;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
	size: 32,
	borderRadius: 10,
	extraMargin: {
		top: 0,
		right: 4,
		bottom: 0,
		left: 0,
	},
	enableRealTimeUpdate: true,
};

export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;
	canvasWithThumbnail = new Map<string, string>(); // canvas路径 -> 图片路径
	private updateTimeout: NodeJS.Timeout;
	private cardObserver: MutationObserver;

	async onload() {
		await this.loadSettings();

		// 等待 workspace 准备好后初始化
		this.app.workspace.onLayoutReady(() => this.initializeCards());
		
		// 监听布局变化
		this.registerEvent(this.app.workspace.on('layout-change', () => {
			this.scheduleUpdate();
		}));

		// 监听文件变化，重新扫描 canvas
		this.registerEvent(this.app.vault.on('modify', (file) => {
			if (file instanceof TFile && file.extension === 'canvas') {
				this.scheduleCanvasUpdate();
			}
		}));

		// 设置插件设置页面
		this.addSettingTab(new MyPluginSettingTab(this.app, this));
	}

	async initializeCards() {
		console.log('初始化 Canvas 缩略图插件...');
		await this.scanCanvasFiles();
		this.updateCardThumbnails();
		
		// 如果启用实时更新，设置观察器
		if (this.settings.enableRealTimeUpdate) {
			this.setupCardObserver();
		}
	}

	async scanCanvasFiles() {
		console.log('扫描 Canvas 文件...');
		const pictureExtensions = ["jpg", "jpeg", "png", "webp", "bmp", "svg", "gif", "ico"];
		const allFiles = this.app.vault.getFiles();
		const canvasFiles = allFiles.filter(file => file.extension === 'canvas');
		
		this.canvasWithThumbnail.clear();

		for (const canvasFile of canvasFiles) {
			try {
				const canvasContent = await this.app.vault.read(canvasFile);
				const canvasData = JSON.parse(canvasContent);
				
				if (canvasData.nodes && Array.isArray(canvasData.nodes)) {
					// 查找第一个图片节点
					for (const node of canvasData.nodes) {
						if (node.type === 'file' && node.file) {
							const nodeFile = this.app.vault.getAbstractFileByPath(node.file);
							if (nodeFile && pictureExtensions.includes(nodeFile.extension.toLowerCase())) {
								this.canvasWithThumbnail.set(canvasFile.path, nodeFile.path);
								console.log(`找到缩略图: ${canvasFile.path} -> ${nodeFile.path}`);
								break; // 只取第一个图片
							}
						}
					}
				}
			} catch (error) {
				console.error(`处理 Canvas 文件出错 ${canvasFile.path}:`, error);
			}
		}
		
		console.log(`扫描完成，找到 ${this.canvasWithThumbnail.size} 个有缩略图的 Canvas`);
	}

	updateCardThumbnails() {
		// 使用防抖，避免频繁更新
		clearTimeout(this.updateTimeout);
		this.updateTimeout = setTimeout(() => {
			addCardThumbnails(this, this.canvasWithThumbnail);
		}, 200);
	}

	scheduleUpdate() {
		clearTimeout(this.updateTimeout);
		this.updateTimeout = setTimeout(() => {
			this.updateCardThumbnails();
		}, 500);
	}

	scheduleCanvasUpdate() {
		clearTimeout(this.updateTimeout);
		this.updateTimeout = setTimeout(async () => {
			await this.scanCanvasFiles();
			this.updateCardThumbnails();
		}, 1000);
	}

	setupCardObserver() {
		// 清理旧的观察器
		if (this.cardObserver) {
			this.cardObserver.disconnect();
		}

		this.cardObserver = new MutationObserver((mutations) => {
			let needsUpdate = false;
			
			mutations.forEach((mutation) => {
				if (mutation.type === 'childList') {
					mutation.addedNodes.forEach((node) => {
						if (node.nodeType === Node.ELEMENT_NODE) {
							const element = node as HTMLElement;
							if (element.classList?.contains('bases-cards-item') || 
								element.querySelector?.('.bases-cards-item')) {
								needsUpdate = true;
							}
						}
					});
				}
			});
			
			if (needsUpdate) {
				this.scheduleUpdate();
			}
		});
		
		// 观察整个 workspace 容器
		const workspaceEl = this.app.workspace.containerEl;
		if (workspaceEl) {
			this.cardObserver.observe(workspaceEl, { 
				childList: true, 
				subtree: true 
			});
			console.log('已设置 DOM 观察器');
		}
	}

	onunload() {
		console.log('卸载 Canvas 缩略图插件...');
		
		if (this.cardObserver) {
			this.cardObserver.disconnect();
		}
		
		if (this.updateTimeout) {
			clearTimeout(this.updateTimeout);
		}

		// 清理已设置的缩略图
		document.querySelectorAll('[data-canvas-thumbnail]').forEach(el => {
			(el as HTMLElement).style.backgroundImage = '';
			el.removeAttribute('data-canvas-thumbnail');
		});
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class MyPluginSettingTab extends PluginSettingTab {
	plugin: MyPlugin;

	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;
		containerEl.empty();

		containerEl.createEl('h2', {text: 'Canvas 缩略图设置'});

		new Setting(containerEl)
			.setName('启用实时更新')
			.setDesc('启用后会自动监听页面变化并更新缩略图')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enableRealTimeUpdate)
				.onChange(async (value) => {
					this.plugin.settings.enableRealTimeUpdate = value;
					await this.plugin.saveSettings();
					
					if (value) {
						this.plugin.setupCardObserver();
					} else if (this.plugin.cardObserver) {
						this.plugin.cardObserver.disconnect();
					}
				}));

		new Setting(containerEl)
			.setName('手动刷新缩略图')
			.setDesc('点击按钮手动重新扫描并更新所有缩略图')
			.addButton(button => button
				.setButtonText('刷新')
				.setCta()
				.onClick(async () => {
					button.setButtonText('刷新中...');
					await this.plugin.scanCanvasFiles();
					this.plugin.updateCardThumbnails();
					button.setButtonText('刷新');
				}));
	}
}
