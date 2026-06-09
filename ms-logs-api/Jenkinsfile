pipeline {
    agent any

    environment {
        APP_NAME     = 'ms-logs-api'
        UI_NAME      = 'ms-logs-ui'
        APP_PORT     = '3004'
        UI_PORT      = '3005'
        NODE_VERSION = '22'

        // Infra ms-logs-api (server-side: internal Docker network URL)
        URL_API_GATEWAY = 'http://ms-gateway-api:3000'
        FRONTEND_URL    = 'http://65.21.97.113:3005'
        MONGO_URI       = "mongodb://root:${MONGO_PASSWORD}@infra-mongo-logs:27017/apilogs?authSource=admin"
        DOCKER_NETWORK  = 'infra-network'

        // Vite build args (browser-side: public IP, gateway on port 80)
        VITE_API_URL          = 'http://65.21.97.113:3004'
        VITE_URL_API_GATEWAY  = 'http://65.21.97.113'
    }

    options {
        timeout(time: 30, unit: 'MINUTES')
        disableConcurrentBuilds()
        buildDiscarder(logRotator(numToKeepStr: '10'))
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
                script {
                    env.GIT_COMMIT_SHORT = sh(
                        script: 'git rev-parse --short HEAD',
                        returnStdout: true
                    ).trim()
                    env.BRANCH_NAME_SAFE = env.BRANCH_NAME?.replaceAll('/', '-') ?: 'main'
                    env.IMAGE_TAG = "${env.BRANCH_NAME_SAFE}-${env.GIT_COMMIT_SHORT}"
                }
            }
        }

        stage('Install Dependencies') {
            steps {
                sh 'npm ci'
            }
        }

        stage('Lint') {
            when {
                expression { fileExists('package.json') && readFile('package.json').contains('"lint"') }
            }
            steps {
                sh 'npm run lint'
            }
        }

        stage('Test') {
            when {
                expression { fileExists('package.json') && readFile('package.json').contains('"test"') }
            }
            steps {
                sh 'npm run test'
            }
            post {
                always {
                    junit allowEmptyResults: true, testResults: 'junit.xml'
                }
            }
        }

        stage('Build') {
            steps {
                sh 'npm run build'
            }
        }

        stage('Docker Build') {
            steps {
                script {
                    // API
                    sh """
                        docker build \
                            --target prod \
                            -t ${APP_NAME}:${IMAGE_TAG} \
                            .
                    """
                    // UI (Vite — reads .env.production at build time; no build-args needed)
                    sh """
                        docker build \
                            -f ui/Dockerfile \
                            --target prod \
                            --no-cache \
                            -t ${UI_NAME}:${IMAGE_TAG} \
                            .
                    """
                }
            }
        }

        stage('Deploy') {
            steps {
                script {
                    // Deploy API
                    sh """
                        docker volume create ms-logs-api-files || true
                        docker stop ${APP_NAME} || true
                        docker rm ${APP_NAME} || true

                        docker run -d \\
                            --name ${APP_NAME} \\
                            --network ${DOCKER_NETWORK} \\
                            --restart unless-stopped \\
                            -p ${APP_PORT}:${APP_PORT} \\
                            -v ms-logs-api-files:/app/dist/files_results \\
                            -e NODE_ENV=production \\
                            -e PORT=${APP_PORT} \\
                            -e URL_API_GATEWAY=${URL_API_GATEWAY} \\
                            -e MONGO_URI=${MONGO_URI} \\
                            -e FRONTEND_URL=${FRONTEND_URL} \\
                            -e X_API_KEY=${X_API_KEY} \\
                            -e SMTP_HOST=smtp.gmail.com \\
                            -e SMTP_PORT=587 \\
                            -e SMTP_USER=${SMTP_USER} \\
                            -e SMTP_PASSWORD=${SMTP_PASSWORD} \\
                            -e RABBITMQ_HOST=infra-rabbitmq \\
                            -e RABBITMQ_PORT=5672 \\
                            -e RABBITMQ_USER=${RABBITMQ_USER} \\
                            -e RABBITMQ_PASSWORD=${RABBITMQ_PASSWORD} \\
                            -e PG_USER_URL=postgresql://postgres:${POSTGRES_PASSWORD}@infra-db-user:5432/ms_user \\
                            -e PG_SFTP_URL=postgresql://postgres:${POSTGRES_PASSWORD}@infra-db-sftp:5432/ms_sftp \\
                            -e PG_PREDICTIONS_URL=postgresql://postgres:${POSTGRES_PASSWORD}@infra-db-predictions:5432/ms_predictions \\
                            -e PG_HYDRO_URL=postgresql://postgres:${POSTGRES_PASSWORD}@infra-db-hydro:5432/ms_hydro \\
                            -e PG_MODEL_URL=postgresql://postgres:${POSTGRES_PASSWORD}@infra-db-model:5432/ms_model \\
                            -e PG_NOTIFICATIONS_URL=postgresql://postgres:${POSTGRES_PASSWORD}@infra-db-notifications:5432/ms_notifications \\
                            -e PG_METEO_URL=postgresql://postgres:${POSTGRES_PASSWORD}@infra-db-meteo:5432/ms_meteo \\
                            ${APP_NAME}:${IMAGE_TAG}
                    """
                    // Deploy UI
                    sh """
                        docker stop ${UI_NAME} || true
                        docker rm ${UI_NAME} || true

                        docker run -d \\
                            --name ${UI_NAME} \\
                            --network ${DOCKER_NETWORK} \\
                            --restart unless-stopped \\
                            -p ${UI_PORT}:80 \\
                            ${UI_NAME}:${IMAGE_TAG}
                    """
                }
            }
        }
    }

    post {
        success {
            echo "Pipeline completed successfully! Deployed ${APP_NAME}:${IMAGE_TAG} on port ${APP_PORT}"
        }
        failure {
            echo 'Pipeline failed. Check the logs above for details.'
        }
        always {
            deleteDir()
        }
    }
}

