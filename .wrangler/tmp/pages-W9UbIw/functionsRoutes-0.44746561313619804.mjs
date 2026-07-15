import { onRequestGet as __go_support_js_onRequestGet } from "C:\\Users\\povar\\Documents\\GitHub\\quartzlab-site\\functions\\go\\support.js"
import { onRequestHead as __go_support_js_onRequestHead } from "C:\\Users\\povar\\Documents\\GitHub\\quartzlab-site\\functions\\go\\support.js"

export const routes = [
    {
      routePath: "/go/support",
      mountPath: "/go",
      method: "GET",
      middlewares: [],
      modules: [__go_support_js_onRequestGet],
    },
  {
      routePath: "/go/support",
      mountPath: "/go",
      method: "HEAD",
      middlewares: [],
      modules: [__go_support_js_onRequestHead],
    },
  ]