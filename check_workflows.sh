#!/bin/bash

# GitHub Actions 工作流程狀態檢查腳本
echo "🔍 檢查 GitHub Actions 工作流程設置..."

# 檢查工作流程檔案是否存在
WORKFLOW_DIR=".github/workflows"

if [ ! -d "$WORKFLOW_DIR" ]; then
    echo "❌ 錯誤: $WORKFLOW_DIR 目錄不存在"
    exit 1
fi

echo "📁 工作流程檔案清單:"
ls -la $WORKFLOW_DIR/

# 檢查每個工作流程檔案
workflows=(
    "sonarcloud.yml"
    "codacy.yml" 
    "codeql.yml"
    "tests.yml"
    "ci.yml"
)

for workflow in "${workflows[@]}"; do
    if [ -f "$WORKFLOW_DIR/$workflow" ]; then
        echo "✅ $workflow - 存在"
    else
        echo "❌ $workflow - 不存在"
    fi
done

# 檢查 SonarCloud 配置
if [ -f "sonar-project.properties" ]; then
    echo "✅ sonar-project.properties - 存在"
else
    echo "❌ sonar-project.properties - 不存在"
fi

# 檢查 Codacy 配置
if [ -f ".codacy.yml" ]; then
    echo "✅ .codacy.yml - 存在"
else
    echo "❌ .codacy.yml - 不存在"
fi

echo ""
echo "🚀 下一步設置 GitHub Secrets:"
echo "1. 前往 GitHub 專案 → Settings → Secrets and variables → Actions"
echo "2. 添加以下 Secrets:"
echo "   - SONAR_TOKEN (從 SonarCloud 取得)"
echo "   - CODACY_PROJECT_TOKEN (從 Codacy 取得)"
echo ""
echo "🔗 相關連結:"
echo "   SonarCloud: https://sonarcloud.io/"
echo "   Codacy: https://www.codacy.com/"
echo ""
echo "📝 推送代碼以觸發工作流程:"
echo "   git add ."
echo "   git commit -m 'Add GitHub Actions workflows'"
echo "   git push origin master"