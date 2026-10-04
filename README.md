# Mark Stabnow | Computer Science ePortfolio

[Open the portfolio](https://mark-stabnow.github.io/)

My CS 499 capstone expands the Warehouse Inventory Android app from CS 360 into a web application. The homepage links the three enhancement categories to their code, documentation, and evidence.

## Review Milestone Four

* [Project overview](artifacts/milestone-four/README.md)
* [Current application source](artifacts/milestone-four/enhanced-pwa/)
* [Database narrative (Word)](artifacts/milestone-four/CS499_Milestone_Four_Narrative_Mark_Stabnow_Formatted.docx)
* [Verification record and limits](artifacts/milestone-four/evidence/VERIFICATION.md)
* [Original Android source](artifacts/milestone-four/original-android/)
* [Milestone Three comparison](artifacts/milestone-four/baseline-milestone-three/)

The committed evidence records 99 local automated tests passing. It does not establish that the current source passes the full Docker, PostgreSQL, production-build, or browser suite. Earlier Milestone Three results are historical evidence, not a substitute for rerunning the updated app.

## Website and application

`index.html` and `assets/portfolio.css` form the static portfolio. They require no JavaScript, npm packages, or Docker. The existing Minima configuration is retained for other Jekyll content. See [homepage maintenance notes](docs/portfolio-homepage.md).

GitHub Pages presents the portfolio and downloadable files. It does not run the Express API or PostgreSQL database. Use the [application instructions](artifacts/milestone-four/enhanced-pwa/README.md) to run the warehouse app locally. Keep real settings in an ignored `.env` file; only `.env.example` belongs in this public repository.

The professional self-assessment, code review video, and separate software design and algorithms narratives are not linked in the homepage yet.
