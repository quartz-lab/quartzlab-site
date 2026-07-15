(() => {
      const buttons = [...document.querySelectorAll("[data-language]")];
      const docs = [...document.querySelectorAll("[data-document-language]")];
      const tocSets = [...document.querySelectorAll("[data-toc-language]")];
      const mobileToc = document.querySelector(".mobile-toc");
      const storageKey = "quartzlab-doc-language";

      const navigation = {
        ru: [
          ["", "Навигация"],
          ["#ru-overview", "Обзор"],
          ["#ru-quick-start", "Быстрый старт"],
          ["#ru-library", "Библиотека"],
          ["#ru-picker", "Выбор клипов"],
          ["#ru-editor", "Аудиоредактор"],
          ["#ru-safety", "История и безопасность"],
          ["#ru-formats", "Форматы"],
          ["#ru-shortcuts", "Управление"],
          ["#ru-limitations", "Ограничения"]
        ],
        en: [
          ["", "Navigation"],
          ["#en-overview", "Overview"],
          ["#en-quick-start", "Quick start"],
          ["#en-library", "Library"],
          ["#en-picker", "Clip picker"],
          ["#en-editor", "Audio Editor"],
          ["#en-safety", "History and safety"],
          ["#en-formats", "Formats"],
          ["#en-shortcuts", "Controls"],
          ["#en-limitations", "Limitations"]
        ]
      };

      function fillMobileNavigation(language) {
        mobileToc.innerHTML = "";
        navigation[language].forEach(([value, label]) => {
          const option = document.createElement("option");
          option.value = value;
          option.textContent = label;
          mobileToc.append(option);
        });
      }

      function setLanguage(language, persist = true) {
        if (!["ru", "en"].includes(language)) language = "en";

        document.documentElement.lang = language;
        document.title = language === "ru"
          ? "ClipSwitch — документация QuartzLab"
          : "ClipSwitch Documentation — QuartzLab";

        buttons.forEach(button => {
          button.setAttribute("aria-pressed", String(button.dataset.language === language));
        });

        docs.forEach(doc => {
          doc.hidden = doc.dataset.documentLanguage !== language;
        });

        tocSets.forEach(toc => {
          toc.hidden = toc.dataset.tocLanguage !== language;
        });

        fillMobileNavigation(language);

        if (persist) {
          try { localStorage.setItem(storageKey, language); } catch (_) {}
        }

        observeSections();
      }

      function observeSections() {
        if (window.__docsObserver) window.__docsObserver.disconnect();

        const activeToc = document.querySelector("[data-toc-language]:not([hidden])");
        if (!activeToc) return;

        const links = [...activeToc.querySelectorAll("a")];
        const sections = links
          .map(link => document.querySelector(link.getAttribute("href")))
          .filter(Boolean);

        window.__docsObserver = new IntersectionObserver(entries => {
          const visible = entries
            .filter(entry => entry.isIntersecting)
            .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

          if (!visible) return;

          links.forEach(link => {
            link.classList.toggle(
              "active",
              link.getAttribute("href") === "#" + visible.target.id
            );
          });
        }, {
          rootMargin: "-18% 0px -72% 0px",
          threshold: [0, .1, .25]
        });

        sections.forEach(section => window.__docsObserver.observe(section));
      }

      buttons.forEach(button => {
        button.addEventListener("click", () => {
          const targetLanguage = button.dataset.language;
          const currentHash = location.hash;
          setLanguage(targetLanguage);

          if (currentHash) {
            const suffix = currentHash.replace(/^#(?:ru|en)-/, "");
            const target = document.querySelector(`#${targetLanguage}-${suffix}`);
            if (target) {
              history.replaceState(null, "", `#${targetLanguage}-${suffix}`);
              target.scrollIntoView({ behavior: "smooth" });
            }
          }
        });
      });

      mobileToc.addEventListener("change", () => {
        if (mobileToc.value) location.hash = mobileToc.value;
      });

      let saved = null;
      try { saved = localStorage.getItem(storageKey); } catch (_) {}

      const browserLanguage =
        (navigator.languages && navigator.languages[0]) ||
        navigator.language ||
        "en";

      const initialLanguage =
        saved || (browserLanguage.toLowerCase().startsWith("ru") ? "ru" : "en");

      setLanguage(initialLanguage, false);
    })();
