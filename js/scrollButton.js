

document.addEventListener("DOMContentLoaded", function () {
  /* ========= BACK TO TOP BUTTON ========= */
  const backToTopBtn = document.getElementById("back-to-top");

  if (backToTopBtn) {
    // Click → scroll smoothly to top
    backToTopBtn.addEventListener("click", function () {
      window.scrollTo({
        top: 0,
        behavior: "smooth"
      });
    });

    // Show button only after scrolling down a bit
    function handleScroll() {
      if (window.scrollY > 200) {
        backToTopBtn.classList.add("visible");
      } else {
        backToTopBtn.classList.remove("visible");
      }
    }

    handleScroll();
    window.addEventListener("scroll", handleScroll);
  }

  /* ========= SMOOTH SCROLL FROM SUMMARY CARD ========= */
  const navOffset = 80; // adjust if your fixed navbar is taller/shorter

  const summaryLinks = document.querySelectorAll(
    '.summary-card a[href^="#"]'
  );

  summaryLinks.forEach(link => {
    link.addEventListener("click", function (e) {
      e.preventDefault();

      const targetId = this.getAttribute("href").substring(1);
      const targetEl = document.getElementById(targetId);
      if (!targetEl) return;

      const rect = targetEl.getBoundingClientRect();
      const scrollY = window.scrollY || window.pageYOffset;
      const targetY = rect.top + scrollY - navOffset;

      window.scrollTo({
        top: targetY,
        behavior: "smooth"
      });
    });
  });

  const path = window.location.pathname;
    const page = path.split("/").pop();

    const links = document.querySelectorAll(".navbar a");

    links.forEach(link => {
      const href = link.getAttribute("href");

      if (href === page) {
        link.classList.add("active");
      }
    });

    const scrollElements = document.querySelectorAll('.animate-on-scroll');

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
          }
        });
      },
      {
        threshold: 0.2 // trigger when 20% of element is visible
      }
    );

    scrollElements.forEach(el => observer.observe(el));
});


