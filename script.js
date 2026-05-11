const FALLBACK_IMAGE = "fallback.jpg";
const STORAGE_PREFIX = "eduguide_reviews_";

let allColleges = [];
let filteredColleges = [];

document.addEventListener("DOMContentLoaded", () => {
  const page = document.body.dataset.page;

  if (page === "explore") {
    initExplorePage();
  }

  if (page === "details") {
    initDetailsPage();
  }
});

async function loadColleges() {
  if (allColleges.length) {
    return allColleges;
  }

  const response = await fetch("./colleges.json");
  if (!response.ok) {
    throw new Error("Unable to load local college dataset.");
  }

  allColleges = await response.json();
  return allColleges;
}

async function initExplorePage() {
  const grid = document.querySelector("#collegeGrid");
  const count = document.querySelector("#resultCount");

  try {
    const colleges = await loadColleges();
    populateFilters(colleges);
    filteredColleges = sortRecommendations(colleges);
    renderCollegeGrid(filteredColleges);
    bindExploreEvents();
  } catch (error) {
    grid.innerHTML = "";
    count.textContent = "Dataset could not be loaded.";
    showToast(error.message);
  }
}

function populateFilters(colleges) {
  const cities = [...new Set(colleges.map((college) => college.city))].sort();
  const types = [...new Set(colleges.map((college) => college.type))].sort();
  const courses = [...new Set(colleges.flatMap((college) => college.courses.map((course) => course.course_name)))].sort();

  fillSelect("#cityFilter", cities);
  fillSelect("#typeFilter", types);
  fillSelect("#courseFilter", courses);
}

function fillSelect(selector, values) {
  const select = document.querySelector(selector);
  values.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  });
}

function bindExploreEvents() {
  ["#searchInput", "#cityFilter", "#courseFilter", "#typeFilter", "#percentageInput"].forEach((selector) => {
    document.querySelector(selector).addEventListener("input", applyFilters);
  });

  document.querySelector("#resetFilters").addEventListener("click", () => {
    document.querySelector("#searchInput").value = "";
    document.querySelector("#cityFilter").value = "";
    document.querySelector("#courseFilter").value = "";
    document.querySelector("#typeFilter").value = "";
    document.querySelector("#percentageInput").value = "";
    applyFilters();
  });

  document.querySelector("#compareTop").addEventListener("click", () => {
    const top = filteredColleges.slice(0, 6);
    renderCollegeGrid(top);
    updateResultCopy(top, true);
  });
}

function applyFilters() {
  const search = document.querySelector("#searchInput").value.trim().toLowerCase();
  const city = document.querySelector("#cityFilter").value;
  const type = document.querySelector("#typeFilter").value;
  const course = document.querySelector("#courseFilter").value;
  const percentage = parseFloat(document.querySelector("#percentageInput").value);

  filteredColleges = allColleges.filter((college) => {
    const textPool = [
      college.name,
      college.city,
      college.location,
      college.type,
      college.description,
      ...college.courses.map((item) => item.course_name)
    ].join(" ").toLowerCase();

    const matchesSearch = !search || textPool.includes(search);
    const matchesCity = !city || college.city === city;
    const matchesType = !type || college.type === type;
    const matchesCourse = !course || college.courses.some((item) => item.course_name === course);
    const matchesPercentage = Number.isNaN(percentage) || college.courses.some((item) => percentage >= getMinimumPercentage(item.eligibility));

    return matchesSearch && matchesCity && matchesType && matchesCourse && matchesPercentage;
  });

  filteredColleges = sortRecommendations(filteredColleges, { course, percentage });
  renderCollegeGrid(filteredColleges);
}

function sortRecommendations(colleges, criteria = {}) {
  const percentage = Number.isFinite(criteria.percentage) ? criteria.percentage : null;
  const course = criteria.course || "";

  return [...colleges].sort((a, b) => {
    const aEligibility = getEligibilityScore(a, percentage, course);
    const bEligibility = getEligibilityScore(b, percentage, course);
    const aPlacement = parsePercent(a.placement_rate);
    const bPlacement = parsePercent(b.placement_rate);
    const aRating = parseFloat(a.rating);
    const bRating = parseFloat(b.rating);

    return bEligibility - aEligibility || bPlacement - aPlacement || bRating - aRating || a.name.localeCompare(b.name);
  });
}

function getEligibilityScore(college, percentage, courseName) {
  if (percentage === null) {
    return 0;
  }

  const courses = courseName ? college.courses.filter((course) => course.course_name === courseName) : college.courses;
  if (!courses.length) {
    return 0;
  }

  const bestRequirement = Math.min(...courses.map((course) => getMinimumPercentage(course.eligibility)));
  if (percentage >= bestRequirement) {
    return 100 + Math.min(percentage - bestRequirement, 30);
  }

  return Math.max(0, percentage - bestRequirement);
}

function renderCollegeGrid(colleges) {
  const grid = document.querySelector("#collegeGrid");
  const empty = document.querySelector("#emptyState");

  grid.innerHTML = colleges.map((college) => {
    const topCourses = college.courses.slice(0, 3).map((course) => `<span class="pill">${escapeHtml(course.course_name)}</span>`).join("");
    const localReviews = getLocalReviews(college.id);
    const reviewCount = college.reviews.length + localReviews.length;

    return `
      <article class="card">
        <img src="${escapeAttribute(college.image)}" alt="${escapeAttribute(college.name)} campus" onerror="this.src='${FALLBACK_IMAGE}'">
        <div class="card-body">
          <div class="card-meta">
            <span>${escapeHtml(college.city)}</span>
            <span>Rating ${escapeHtml(String(college.rating))}</span>
            <span>${escapeHtml(college.placement_rate)} placed</span>
          </div>
          <h2>${escapeHtml(college.name)}</h2>
          <div class="pill-row">
            <span class="pill hot">${escapeHtml(college.type)}</span>
            ${topCourses}
          </div>
          <p class="small-muted">${escapeHtml(college.avg_package)} average package · ${reviewCount} reviews</p>
          <div class="card-actions">
            <a class="btn compact" href="./details.html?id=${college.id}">Details</a>
            <a class="btn ghost compact" href="${escapeAttribute(college.maps)}" target="_blank" rel="noopener">Map</a>
          </div>
        </div>
      </article>
    `;
  }).join("");

  empty.hidden = colleges.length !== 0;
  updateResultCopy(colleges);
}

function updateResultCopy(colleges, topOnly = false) {
  const count = document.querySelector("#resultCount");
  const hint = document.querySelector("#resultHint");
  const percentageValue = document.querySelector("#percentageInput")?.value;

  count.textContent = `${colleges.length} ${topOnly ? "top matches" : "college recommendations"}`;
  hint.textContent = percentageValue
    ? "Sorted by eligibility, placement rate, and rating."
    : "Enter 12th percentage to prioritize eligible colleges first.";
}

async function initDetailsPage() {
  const root = document.querySelector("#detailsRoot");

  try {
    const colleges = await loadColleges();
    const id = Number(new URLSearchParams(window.location.search).get("id")) || colleges[0].id;
    const college = colleges.find((item) => item.id === id);

    if (!college) {
      root.innerHTML = `
        <section class="empty-state">
          <h1>College not found.</h1>
          <p>The selected profile is not available in the local dataset.</p>
          <a class="btn primary" href="./explore.html">Back to Explore</a>
        </section>
      `;
      return;
    }

    renderDetails(college);
    bindReviewForm(college);
  } catch (error) {
    root.innerHTML = `
      <section class="empty-state">
        <h1>Details could not be loaded.</h1>
        <p>${escapeHtml(error.message)}</p>
      </section>
    `;
  }
}

function renderDetails(college) {
  const root = document.querySelector("#detailsRoot");
  const reviews = [...college.reviews, ...getLocalReviews(college.id)];
  const courses = college.courses.map((course) => `
    <tr>
      <td>${escapeHtml(course.course_name)}</td>
      <td>${escapeHtml(course.duration)}</td>
      <td>${escapeHtml(course.semester_fee)}</td>
      <td>${escapeHtml(course.total_fee)}</td>
      <td>${escapeHtml(course.eligibility)}</td>
      <td>${escapeHtml(course.placement_rate)}</td>
    </tr>
  `).join("");

  root.innerHTML = `
    <section class="details-hero">
      <img class="details-cover" src="${escapeAttribute(college.image)}" alt="${escapeAttribute(college.name)} campus" onerror="this.src='${FALLBACK_IMAGE}'">
      <div class="details-intro">
        <div>
          <p class="eyebrow">${escapeHtml(college.city)} · ${escapeHtml(college.type)}</p>
          <h1>${escapeHtml(college.name)}</h1>
          <p class="details-text">${escapeHtml(college.description)}</p>
        </div>
        <div class="details-actions">
          <a class="btn primary" href="${escapeAttribute(college.website)}" target="_blank" rel="noopener">Official Website</a>
          <a class="btn ghost" href="${escapeAttribute(college.maps)}" target="_blank" rel="noopener">Google Maps</a>
          <a class="btn ghost" href="./explore.html">Back</a>
        </div>
      </div>
    </section>

    <section class="stat-grid" aria-label="College statistics">
      <div class="details-card"><strong>${escapeHtml(String(college.rating))}/5</strong><span>Expert rating</span></div>
      <div class="details-card"><strong>${escapeHtml(String(college.student_review_score))}/5</strong><span>Student score</span></div>
      <div class="details-card"><strong>${escapeHtml(college.placement_rate)}</strong><span>Placement rate</span></div>
      <div class="details-card"><strong>${escapeHtml(college.highest_package)}</strong><span>Highest package</span></div>
      <div class="details-card"><strong>${escapeHtml(college.avg_package)}</strong><span>Average package</span></div>
      <div class="details-card"><strong>${college.hostel ? "Available" : "Limited"}</strong><span>Hostel</span></div>
      <div class="details-card"><strong>${college.transport ? "Available" : "Limited"}</strong><span>Transport</span></div>
      <div class="details-card"><strong>${escapeHtml(college.location)}</strong><span>Location</span></div>
    </section>

    <section class="details-layout">
      <div>
        <h2 class="section-title">Courses and Fees</h2>
        <div class="course-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Course</th>
                <th>Duration</th>
                <th>Semester fee</th>
                <th>Total fee</th>
                <th>Eligibility</th>
                <th>Placement</th>
              </tr>
            </thead>
            <tbody>${courses}</tbody>
          </table>
        </div>
      </div>

      <aside>
        <h2 class="section-title">Student Reviews</h2>
        <div id="reviewList" class="review-list">
          ${renderReviewItems(reviews)}
        </div>

        <form id="reviewForm" class="review-form">
          <div class="form-row">
            <label>
              <span>Name</span>
              <input id="reviewName" type="text" maxlength="42" placeholder="Your name" required>
            </label>
            <label>
              <span>Rating</span>
              <select id="reviewRating" required>
                <option value="5">5</option>
                <option value="4.5">4.5</option>
                <option value="4">4</option>
                <option value="3.5">3.5</option>
              </select>
            </label>
          </div>
          <label>
            <span>Review</span>
            <textarea id="reviewComment" maxlength="260" placeholder="Share placement, hostel, faculty, coding culture, or campus life experience." required></textarea>
          </label>
          <button class="btn primary" type="submit">Add Review</button>
        </form>
      </aside>
    </section>
  `;
}

function renderReviewItems(reviews) {
  if (!reviews.length) {
    return `<div class="review-item"><p>No reviews yet. Add the first one.</p></div>`;
  }

  return reviews.map((review) => `
    <article class="review-item">
      <strong>
        <span>${escapeHtml(review.student)}</span>
        <span>${escapeHtml(String(review.rating))}/5</span>
      </strong>
      <p>${escapeHtml(review.comment)}</p>
    </article>
  `).join("");
}

function bindReviewForm(college) {
  document.querySelector("#reviewForm").addEventListener("submit", (event) => {
    event.preventDefault();

    const review = {
      student: document.querySelector("#reviewName").value.trim(),
      rating: document.querySelector("#reviewRating").value,
      comment: document.querySelector("#reviewComment").value.trim()
    };

    if (!review.student || !review.comment) {
      showToast("Please add your name and review.");
      return;
    }

    const reviews = getLocalReviews(college.id);
    reviews.unshift(review);
    localStorage.setItem(`${STORAGE_PREFIX}${college.id}`, JSON.stringify(reviews));
    document.querySelector("#reviewList").innerHTML = renderReviewItems([...college.reviews, ...reviews]);
    event.target.reset();
    showToast("Review saved locally in this browser.");
  });
}

function getLocalReviews(id) {
  try {
    return JSON.parse(localStorage.getItem(`${STORAGE_PREFIX}${id}`)) || [];
  } catch (error) {
    return [];
  }
}

function getMinimumPercentage(eligibility) {
  const matches = String(eligibility).match(/(\d+(\.\d+)?)\s*%/);
  return matches ? parseFloat(matches[1]) : 50;
}

function parsePercent(value) {
  return parseFloat(String(value).replace("%", "")) || 0;
}

function showToast(message) {
  const existing = document.querySelector(".toast");
  if (existing) {
    existing.remove();
  }

  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3200);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}
