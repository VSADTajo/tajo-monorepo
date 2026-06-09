pipeline {
    agent any

    environment {
        APP_NAME     = 'ms-user-api'
        APP_PORT     = '3001'
        DB_HOST      = 'infra-db-user'
        DB_DATABASE  = 'ms_user'
        NODE_VERSION = '22'
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
            when { branch 'main' }
            steps {
                script {
                    sh """
                        docker stop ${APP_NAME} || true
                        docker rm ${APP_NAME} || true
                        docker run -d \
                            --name ${APP_NAME} \
                            --network infra-network \
                            --restart unless-stopped \
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
                            -e RABBITMQ_ENABLED=true \
                            -e ALLOWED_ORIGINS=* \
                            ${APP_NAME}:${IMAGE_TAG}
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
