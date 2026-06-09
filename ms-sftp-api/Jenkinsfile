pipeline {
    agent any

    environment {
        APP_NAME          = 'ms-sftp-api'
        APP_PORT          = '3003'
        SFTP_PORT         = '8212'
        DB_HOST           = 'infra-db-sftp'
        DB_DATABASE       = 'ms_sftp'
        NODE_VERSION      = '22'
        FRONTEND_NAME     = 'sftp-frontend'
        FRONTEND_PORT     = '5174'
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
            steps {
                sh 'npm run lint'
            }
        }

        stage('Test') {
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
                    sh """
                        DOCKER_BUILDKIT=1 docker build \
                            --target prod \
                            -t ${APP_NAME}:${IMAGE_TAG} \
                            .
                    """
                }
            }
        }

        stage('Deploy') {
            steps {
                script {
                    sh """
                        docker volume create sftp-storage || true
                        docker volume create sftp-keys || true
                        docker stop ${APP_NAME} || true
                        docker rm ${APP_NAME} || true
                        docker run -d \
                            --name ${APP_NAME} \
                            --network infra-network \
                            --restart unless-stopped \
                            -p ${SFTP_PORT}:${SFTP_PORT} \
                            -v sftp-storage:/data/files \
                            -v sftp-keys:/data/sftp \
                            -e NODE_ENV=development \
                            -e APP_NAME=${APP_NAME} \
                            -e APP_URL=0.0.0.0 \
                            -e APP_PORT=${APP_PORT} \
                            -e APP_LOG_LEVEL=info \
                            -e LOGS_API_URL=http://ms-logs-api:3004 \
                            -e X_API_KEY=${X_API_KEY} \
                            -e DB_HOST=${DB_HOST} \
                            -e DB_PORT=5432 \
                            -e DB_DATABASE=${DB_DATABASE} \
                            -e DB_USERNAME=${POSTGRES_USER} \
                            -e DB_PASSWORD=${POSTGRES_PASSWORD} \
                            -e DB_SYNCHRONIZE=false \
                            -e DB_SSL=false \
                            -e DB_LOGGING=true \
                            -e REDIS_HOST=infra-redis \
                            -e REDIS_PORT=6379 \
                            -e REDIS_DEFAULT_TTL=300 \
                            -e RABBITMQ_HOST=infra-rabbitmq \
                            -e RABBITMQ_PORT=5672 \
                            -e RABBITMQ_USER=${RABBITMQ_USER} \
                            -e RABBITMQ_PASSWORD=${RABBITMQ_PASSWORD} \
                            -e RABBITMQ_VHOST=/ \
                            -e RABBITMQ_PREFETCH=10 \
                            -e RABBITMQ_ENABLED=false \
                            -e STORAGE_BASE_PATH=/data/files \
                            -e STORAGE_MAX_FILE_SIZE=524288000 \
                            -e SFTP_CONNECTION_TIMEOUT=10000 \
                            -e SFTP_OPERATION_TIMEOUT=60000 \
                            -e SFTP_SERVER_ENABLED=true \
                            -e SFTP_SERVER_PORT=${SFTP_PORT} \
                            -e SFTP_SERVER_HOST_KEY_PATH=/data/sftp/host_key \
                            -e SFTP_SERVER_AUTO_GENERATE_HOST_KEY=true \
                            -e SFTP_SERVER_MAX_CONNECTIONS=10 \
                            -e AUTH_API_URL=http://ms-authentication-api:3002 \
                            ${APP_NAME}:${IMAGE_TAG}
                    """
                }
            }
        }

        stage('Frontend - Docker Build') {
            steps {
                script {
                    sh """
                        docker build \
                            --target prod \
                            --build-arg VITE_AUTH_API_URL=http://65.21.97.113 \
                            -t ${FRONTEND_NAME}:${IMAGE_TAG} \
                            ./frontend
                    """
                }
            }
        }

        stage('Frontend - Deploy') {
            steps {
                script {
                    sh """
                        docker stop ${FRONTEND_NAME} || true
                        docker rm ${FRONTEND_NAME} || true
                        docker run -d \
                            --name ${FRONTEND_NAME} \
                            --network infra-network \
                            --restart unless-stopped \
                            -p ${FRONTEND_PORT}:80 \
                            ${FRONTEND_NAME}:${IMAGE_TAG}
                    """
                }
            }
        }
    }

    post {
        success {
            echo "Pipeline completed successfully! Deployed ${APP_NAME}:${IMAGE_TAG} on port ${APP_PORT} and ${FRONTEND_NAME}:${IMAGE_TAG} on port ${FRONTEND_PORT}"
        }
        failure {
            echo 'Pipeline failed. Check the logs above for details.'
        }
        always {
            deleteDir()
        }
    }
}
