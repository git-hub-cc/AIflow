import os

def save_all_paths_to_file(root_dir, output_file):
    with open(output_file, 'w', encoding='utf-8') as f:
        for dirpath, dirnames, filenames in os.walk(root_dir):
            # 写入目录路径
            f.write(f"{os.path.abspath(dirpath)}\n")
            # 写入文件路径
            for filename in filenames:
                full_path = os.path.abspath(os.path.join(dirpath, filename))
                f.write(f"{full_path}\n")

if __name__ == "__main__":
    # 当前目录
    current_dir = os.getcwd()
    # 输出路径文件
    output_path_file = "path.txt"
    save_all_paths_to_file(current_dir, output_path_file)
    print(f"所有路径已保存至 {output_path_file}")
