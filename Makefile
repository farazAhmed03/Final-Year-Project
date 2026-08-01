.PHONY: setup install dev test build up down logs seed

setup:
	node scripts/setup-env.js

install:
	npm --prefix backend install
	npm --prefix frontend install

dev:
	@echo "Run 'npm run dev' in backend and 'npm start' in frontend in separate terminals."

test:
	npm --prefix backend test
	CI=true npm --prefix frontend test -- --watchAll=false

build:
	npm --prefix frontend run build

up:
	docker compose up --build

down:
	docker compose down

logs:
	docker compose logs -f

seed:
	docker compose exec backend npm run seed
