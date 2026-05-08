export default {
    extends: [
        "stylelint-config-standard",
        "stylelint-config-recess-order",
    ],
    plugins: ["stylelint-order", "@stylistic/stylelint-plugin"],
    overrides: [
        {
            files: ["**/*.(css|html)"],
            customSyntax: "postcss-html",
        },
    ],
    rules: {
        "@stylistic/indentation": 4,
        "@stylistic/block-opening-brace-space-before": "always",
        "selector-class-pattern": null,
        "no-descending-specificity": null,
        "scss/dollar-variable-pattern": null,
        "scss/at-extend-no-missing-placeholder": null,
        "value-keyword-case": [
            "lower",
            {
                ignoreFunctions: ["v-bind"],
            },
        ],
        "selector-pseudo-class-no-unknown": [
            true,
            {
                ignorePseudoClasses: ["deep", "global"],
            },
        ],
        "selector-pseudo-element-no-unknown": [
            true,
            {
                ignorePseudoElements: ["v-deep", "v-global", "v-slotted"],
            },
        ],
        "at-rule-no-unknown": [
            true,
            {
                ignoreAtRules: [
                    "tailwind",
                    "apply",
                    "variants",
                    "responsive",
                    "screen",
                    "function",
                    "if",
                    "each",
                    "include",
                    "mixin",
                    "use",
                    "extend",
                ],
            },
        ],
        "rule-empty-line-before": [
            "always",
            {
                ignore: ["after-comment", "first-nested"],
            },
        ],
        "unit-no-unknown": [true, { ignoreUnits: ["rpx"] }],
        "declaration-property-value-no-unknown": null,
        "order/order": [
            [
                "dollar-variables",
                "custom-properties",
                "at-rules",
                "declarations",
                {
                    type: "at-rule",
                    name: "supports",
                },
                {
                    type: "at-rule",
                    name: "media",
                },
                "rules",
            ],
            { severity: "warning" },
        ],
    },
    ignoreFiles: ["**/*.js", "**/*.ts", "**/*.jsx", "**/*.tsx"],
};
