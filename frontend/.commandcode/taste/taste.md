# Taste

- Never generates demo pages, mock data, placeholder responses, or fake APIs — every feature must consume real backend endpoints and work end-to-end before being considered done. Confidence: 0.95
- Wants design references improved significantly rather than copied verbatim ("improve it significantly, do NOT copy it exactly"). Confidence: 0.9
- Considers a task complete only when it is production-ready and verified end-to-end (typecheck/build pass, dev server boots, backend connectivity confirmed through the proxy). Confidence: 0.85
- Wants explicit handling of all failure modes (404, 500, unauthorized, network/offline, empty data) with loading skeletons, empty states, and dedicated error pages. Confidence: 0.85
- Prioritizes accessibility by default: keyboard navigation, ARIA labels, semantic HTML, and visible focus states. Confidence: 0.85
