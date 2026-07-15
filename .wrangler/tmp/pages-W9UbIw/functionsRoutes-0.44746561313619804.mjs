import { onRequestGet as __go_support_js_onRequestGet } from "C:\\Users\\povar\\Documents\\GitHub\\quartzlab-site\\functions\\go\\support.js"
import { onRequestHead as __go_support_js_onRequestHead } from "C:\\Users\\povar\\Documents\\GitHub\\quartzlab-site\\functions\\go\\support.js"
import { onRequest as __docs_html_js_onRequest } from "C:\\Users\\povar\\Documents\\GitHub\\quartzlab-site\\functions\\docs.html.js"
import { onRequest as __plugin_html_js_onRequest } from "C:\\Users\\povar\\Documents\\GitHub\\quartzlab-site\\functions\\plugin.html.js"
import { onRequest as ___middleware_js_onRequest } from "C:\\Users\\povar\\Documents\\GitHub\\quartzlab-site\\functions\\_middleware.js"

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
  {
      routePath: "/docs.html",
      mountPath: "/",
      method: "",
      middlewares: [],
      modules: [__docs_html_js_onRequest],
    },
  {
      routePath: "/plugin.html",
      mountPath: "/",
      method: "",
      middlewares: [],
      modules: [__plugin_html_js_onRequest],
    },
  {
      routePath: "/",
      mountPath: "/",
      method: "",
      middlewares: [___middleware_js_onRequest],
      modules: [],
    },
  ]