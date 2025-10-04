// src/utils/index.js

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