#!/bin/bash
# 便捷运行脚本（自动加载 .env）

# 加载环境变量
if [ -f .env ]; then
  export $(cat .env | grep -v '^#' | xargs)
fi

# 运行命令
node "$@"
