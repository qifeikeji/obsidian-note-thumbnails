import MyPlugin from "./main";
import {FileSystemAdapter} from "obsidian";

/**
 * 为 bases-cards 添加缩略图
 * @param plugin - 插件实例
 * @param data - Canvas路径到图片路径的映射
 */
export const addCardThumbnails = (
	plugin: MyPlugin,
	data: Map<string, string>,
): void => {
	console.log('开始更新卡片缩略图...', data.size);
	
	// 查找 bases-cards 容器
	const cardsContainer = document.querySelector('.bases-cards-container');
	if (!cardsContainer) {
		console.log('未找到 .bases-cards-container');
		return;
	}

	let updatedCount = 0;

	data.forEach((imagePath, canvasPath) => {
		const canvasFileName = getFileNameFromPath(canvasPath);
		const cardElement = findCardByFileName(cardsContainer, canvasFileName);
		
		if (cardElement) {
			const coverElement = cardElement.querySelector('.bases-cards-cover') as HTMLElement;
			if (coverElement && !coverElement.getAttribute('data-canvas-thumbnail')) {
				setCardThumbnail(plugin, imagePath, coverElement, canvasPath);
				updatedCount++;
				console.log(`已设置缩略图: ${canvasFileName} -> ${imagePath}`);
			}
		} else {
			console.log(`未找到对应的卡片: ${canvasFileName}`);
		}
	});
	
	console.log(`缩略图更新完成，共更新 ${updatedCount} 个卡片`);
};

/**
 * 从文件路径中提取文件名（不含扩展名）
 */
function getFileNameFromPath(filePath: string): string {
	return filePath.split('/').pop()?.replace('.canvas', '') || '';
}

/**
 * 根据文件名查找对应的卡片元素
 */
function findCardByFileName(container: Element, fileName: string): HTMLElement | null {
	const cards = container.querySelectorAll('.bases-cards-item');
	
	for (const card of cards) {
		const nameElement = card.querySelector('[data-property="file.name"]');
		const cardFileName = nameElement?.textContent?.trim();
		
		// 精确匹配或包含匹配
		if (cardFileName === fileName || cardFileName?.includes(fileName)) {
			return card as HTMLElement;
		}
	}
	
	return null;
}

/**
 * 为单个卡片设置缩略图
 */
function setCardThumbnail(
	plugin: MyPlugin, 
	imagePath: string, 
	coverElement: HTMLElement, 
	canvasPath: string
): void {
	const adapter = plugin.app.vault.adapter;
	
	if (adapter instanceof FileSystemAdapter) {
		const imageUrl = adapter.getResourcePath(imagePath);
		
		// 设置背景图片样式
		coverElement.style.backgroundImage = `url('${imageUrl}') !important`;
		coverElement.style.backgroundSize = 'contain !important';
		coverElement.style.backgroundRepeat = 'no-repeat !important';
		coverElement.style.backgroundPosition = 'center !important';
		
		// 标记已处理，避免重复设置
		coverElement.setAttribute('data-canvas-thumbnail', canvasPath);
		coverElement.setAttribute('data-image-path', imagePath);
		
		console.log(`缩略图已设置: ${imageUrl}`);
	} else {
		console.error('无法获取文件系统适配器');
	}
}

/**
 * 清理所有已设置的缩略图
 */
export const clearAllThumbnails = (): void => {
	const thumbnailElements = document.querySelectorAll('[data-canvas-thumbnail]');
	
	thumbnailElements.forEach(element => {
		const htmlElement = element as HTMLElement;
		htmlElement.style.backgroundImage = '';
		htmlElement.removeAttribute('data-canvas-thumbnail');
		htmlElement.removeAttribute('data-image-path');
	});
	
	console.log(`已清理 ${thumbnailElements.length} 个缩略图`);
};

/**
 * 获取当前已设置缩略图的统计信息
 */
export const getThumbnailStats = (): {total: number, paths: string[]} => {
	const thumbnailElements = document.querySelectorAll('[data-canvas-thumbnail]');
	const paths: string[] = [];
	
	thumbnailElements.forEach(element => {
		const canvasPath = element.getAttribute('data-canvas-thumbnail');
		if (canvasPath) {
			paths.push(canvasPath);
		}
	});
	
	return {
		total: thumbnailElements.length,
		paths: paths
	};
};
