// eslint-disable-next-line @typescript-eslint/no-var-requires
const {readGitignoreFiles} = require("eslint-gitignore");

module.exports = {
    root: true,
    env: {
        browser: true,
        node: true,
        es2021: true
    },
    settings: {
        react: {
            version: "17.0"
        }
    },
    extends: [
        "eslint:recommended",
        "plugin:react/recommended",
        "plugin:@typescript-eslint/recommended",
        "plugin:import/recommended",
        "plugin:import/typescript"
    ],
    parser: "@typescript-eslint/parser",
    parserOptions: {
        ecmaFeatures: {
            jsx: true
        },
        ecmaVersion: 12,
        sourceType: "module"
    },
    plugins: ["react", "react-hooks", "@typescript-eslint"],
    ignorePatterns: readGitignoreFiles({cdw: __dirname}),
    rules: {
        "react/prop-types": "off",
        "react/react-in-jsx-scope": "off",
        "import/order": [
            "error",
            {
                alphabetize: {
                    order: "asc"
                }
            }
        ],
        "@typescript-eslint/no-non-null-assertion": "off"
    }
};
