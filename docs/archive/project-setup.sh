# Create project directory
mkdir email-personalization-agent
cd email-personalization-agent

# Initialize Node.js project
npm init -y

# Install dependencies
npm install express axios dotenv openai

# Create environment file (for local development)
touch .env

# Create core files
touch server.js
mkdir src
touch src/emailProcessor.js
touch src/domainChecker.js
touch src/webScraper.js
touch src/emailGenerator.js
touch src/slackNotifier.js
