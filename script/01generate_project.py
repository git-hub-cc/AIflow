#!/usr/bin/env python3
import os
import re
import sys

# --- 配置 ---
# 包含所有代码片段的源文件名
SOURCE_FILE = 'code.md'
# --- 配置结束 ---

def main():
    """
    主函数，执行文件解析和生成。
    """
    print("🚀 开始从代码转储文件生成 Vue 项目结构...")

    try:
        with open(SOURCE_FILE, 'r', encoding='utf-8') as f:
            content = f.read()
    except FileNotFoundError:
        print(f"❌ 错误: 源文件 '{SOURCE_FILE}' 未找到。")
        print("请确保已将所有代码片段复制到该文件中，并将其与此脚本放在同一目录。")
        sys.exit(1)

    # 正则表达式，用于匹配每个文件块
    pattern = re.compile(
        r"--- START OF FILE (.+?) ---\n(.*?)\n--- END OF FILE \1 ---",
        re.DOTALL
    )

    matches = list(pattern.finditer(content))

    if not matches:
        print(f"🤷‍♂️ 未在 '{SOURCE_FILE}' 中找到任何有效的文件块。")
        print("请检查文件格式是否正确。")
        return

    print(f"🔍 找到了 {len(matches)} 个文件，准备生成...")
    files_created_count = 0

    for match in matches:
        file_path_raw = match.group(1).strip()
        raw_content = match.group(2)

        # 替换路径分隔符以适应当前操作系统
        file_path = file_path_raw.replace('/', os.path.sep).replace('\\', os.path.sep)

        # --- [ 新增逻辑: 移除 Markdown 代码块包裹 ] ---
        # 首先去除首尾可能存在的空白符
        content_to_check = raw_content.strip()
        is_code_block = False

        # 检查是否被 ``` 包裹
        if content_to_check.startswith('```') and content_to_check.endswith('```'):
            lines = content_to_check.splitlines()
            # 确保至少有包裹的两行
            if len(lines) > 1:
                # 提取第一行和最后一行之间的内容
                final_content = '\n'.join(lines[1:-1])
                is_code_block = True
            else:
                # 处理空代码块 ``` ``` 的情况
                final_content = ""
                is_code_block = True
        else:
            # 如果不是代码块，则使用原始内容
            final_content = raw_content
        # --- [ 逻辑结束 ] ---

        try:
            # 获取文件所在的目录
            directory = os.path.dirname(file_path)

            # 如果存在目录，则创建它
            if directory:
                os.makedirs(directory, exist_ok=True)

            # 写入文件内容
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(final_content)

            if is_code_block:
                print(f"✅ 已解包并创建文件: {file_path}")
            else:
                print(f"✅ 已创建文件: {file_path}")

            files_created_count += 1

        except IOError as e:
            print(f"❌ 写入文件 {file_path} 时发生 I/O 错误: {e}")
        except Exception as e:
            print(f"❌ 处理文件 {file_path} 时发生未知错误: {e}")

    print("\n----------------------------------------")
    print(f"🎉 项目生成完毕！")
    print(f"   - 总共处理并创建了 {files_created_count} 个文件。")
    print("\n下一步:")
    print("1. 打开终端，进入当前目录。")
    print("2. 运行 `npm install` (或 yarn, pnpm) 来安装所有依赖。")
    print("3. 运行 `npm run dev` 来启动开发服务器。")
    print("----------------------------------------")


if __name__ == "__main__":
    main()