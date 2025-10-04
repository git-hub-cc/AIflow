import os

target_extensions = {'.java', '.html', '.js', '.css', '.md', '.txt'}
MAX_LINES = 1000  # 最大行数限制

def collect_files(path):
    collected = []
    if os.path.isfile(path):
        ext = os.path.splitext(path)[1].lower()
        if ext in target_extensions:
            collected.append(path)
    elif os.path.isdir(path):
        for root, _, files in os.walk(path):
            for file in files:
                if os.path.splitext(file)[1].lower() in target_extensions:
                    collected.append(os.path.join(root, file))
    return collected

def read_file_with_fallback(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            return f.readlines()
    except UnicodeDecodeError:
        try:
            with open(filepath, 'r', encoding='gbk', errors='ignore') as f:
                return f.readlines()
        except Exception as e:
            print(f"读取失败: {filepath}，错误: {e}")
            return None

def read_paths():
    try:
        with open('path.txt', 'r', encoding='utf-8') as f:
            return [line.strip() for line in f if line.strip()]
    except UnicodeDecodeError:
        with open('path.txt', 'r', encoding='gbk', errors='ignore') as f:
            return [line.strip() for line in f if line.strip()]

def main():
    paths = read_paths()

    all_target_files = []
    for path in paths:
        all_target_files.extend(collect_files(path))

    # ✅ 去重处理（确保每个文件只处理一次）
    unique_files = list(set(all_target_files))

    with open('content.txt', 'w', encoding='utf-8') as out_file:
        for file_path in unique_files:
            lines = read_file_with_fallback(file_path)
            if lines is not None:
                out_file.write(f'\n\n====== {file_path} ======\n\n')
                if len(lines) > MAX_LINES:
                    print(f"⚠️ 文件超过 {MAX_LINES} 行，仅写入前 {MAX_LINES} 行：{file_path}")
                    out_file.write(f'⚠️ 以下内容已被截断，仅显示前 {MAX_LINES} 行。\n\n')
                    lines = lines[:MAX_LINES]
                out_file.writelines(lines)

    print(f"\n✅ 已合并 {len(unique_files)} 个唯一文件到 content.txt")

if __name__ == '__main__':
    main()
