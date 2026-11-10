# -*- coding: utf-8 -*-
"""
CHANGELOG.md → changelog-data.js 自动转换脚本
每次修改 CHANGELOG.md 后运行此脚本即可更新数据文件
"""
import os

PROJECT = r'D:\Learing\WXOutput\merge-game'
CHANGELOG_PATH = os.path.join(PROJECT, 'CHANGELOG.md')
OUTPUT_DIR = os.path.join(PROJECT, 'js', 'data')
OUTPUT_PATH = os.path.join(OUTPUT_DIR, 'changelog-data.js')

def convert():
    # 读取 CHANGELOG.md
    with open(CHANGELOG_PATH, 'r', encoding='utf-8') as f:
        content = f.read()

    # 转义为 JS 模板字面量
    js_content = content.replace('\\', '\\\\').replace('`', '\\`').replace('${', '\\${')

    # 生成 JS 文件
    js_output = (
        '/**\n'
        ' * CHANGELOG 数据文件\n'
        ' * 自动从 CHANGELOG.md 生成，供版本号弹窗展示使用\n'
        ' * 修改 CHANGELOG.md 后运行此脚本更新\n'
        ' */\n'
        '(function() {\n'
        "  'use strict';\n"
        '  window.CHANGELOG_CONTENT = `' + js_content + '`;\n'
        '})();\n'
    )

    os.makedirs(OUTPUT_DIR, exist_ok=True)
    with open(OUTPUT_PATH, 'w', encoding='utf-8') as f:
        f.write(js_output)

    print('✓ 已更新: ' + OUTPUT_PATH)
    print('  内容长度: ' + str(len(content)) + ' 字符')

if __name__ == '__main__':
    convert()
