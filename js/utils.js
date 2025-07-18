// js/utils.js

/**
 * 生成一个唯一的ID
 * @returns {string} 唯一的ID字符串
 */
export function generateUniqueId() {
    return 'card_' + Date.now() + Math.random().toString(16).slice(2);
}

/**
 * 将DOM元素的位置限制在父容器内 (X不限制，Y轴不限制)
 * @param {HTMLElement} element 要移动的元素
 * @param {HTMLElement} container 父容器
 * @param {number} newX 元素的X坐标
 * @param {number} newY 元素的Y坐标
 * @returns {{x: number, y: number}} 调整后的X, Y坐标
 */
export function constrainPosition(element, container, newX, newY) {
    // 根据需求，不限制内容拖拽的高度，因此直接使用传入的 newY
    return { x: newX, y: newY };
}


/**
 * 清空指定元素的全部子节点
 * @param {HTMLElement} element 要清空的DOM元素
 */
export function clearElementChildren(element) {
    while (element.firstChild) {
        element.removeChild(element.firstChild);
    }
}

/**
 * 延迟函数，用于等待指定毫秒
 * @param {number} ms 延迟毫秒数
 * @returns {Promise<void>}
 */
export function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}


/**
 * 计算两个点之间的贝塞尔曲线路径
 * 这通常用于连接图节点，使连线更平滑和美观。
 * @param {number} x1 - 起始点 x 坐标
 * @param {number} y1 - 起始点 y 坐标
 * @param {number} x2 - 结束点 x 坐标
 * @param {number} y2 - 结束点 y 坐标
 * @param {number} strength - 控制点强度，影响曲线的弯曲度
 * @returns {string} SVG Path 'd' 属性字符串
 */
export function getBezierPath(x1, y1, x2, y2, strength = 0.5) {
    strength = Math.max(0, Math.min(1, strength));

    let cx1, cy1, cx2, cy2;
    const controlOffset = Math.max(50, Math.abs(x2 - x1) * 0.3 * strength);

    // 默认向右弯曲，适合从左到右的连接
    cx1 = x1 + controlOffset;
    cy1 = y1;
    cx2 = x2 - controlOffset;
    cy2 = y2;

    // 如果是反向连接 (x2 < x1)，则调整控制点以避免线条重叠
    if (x2 < x1) {
        cx1 = x1 - controlOffset;
        cx2 = x2 + controlOffset;
    }

    return `M${x1},${y1} C${cx1},${cy1} ${cx2},${cy2} ${x2},${y2}`;
}

/**
 * 简单的模态框工具函数
 * @param {HTMLElement} modalElement - 模态框的DOM元素
 * @returns {{show: function, hide: function}} 包含显示和隐藏模态框的方法
 */
export function createModal(modalElement) {
    const closeButton = modalElement.querySelector('.close-button');

    const show = () => {
        modalElement.style.display = 'flex'; // 使用 flex 布局居中内容
        // 确保动画在显示时触发
        modalElement.querySelector('.modal-content').style.animation = 'fadeInScale 0.3s ease-out';
    };

    const hide = () => {
        modalElement.style.display = 'none';
    };

    // 点击关闭按钮隐藏
    if (closeButton) {
        closeButton.addEventListener('click', hide);
    }

    // 点击模态框外部区域隐藏
    modalElement.addEventListener('click', (e) => {
        if (e.target === modalElement) {
            hide();
        }
    });

    return { show, hide };
}