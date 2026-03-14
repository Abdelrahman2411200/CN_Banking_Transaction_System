up:
	docker compose up --build -d

test:
	npm run test:all

down:
	docker compose down -v

logs:
	docker compose logs -f
