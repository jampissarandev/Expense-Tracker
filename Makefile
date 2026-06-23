.PHONY: db-up db-down db-reset

db-up:
	docker compose -f docker/postgres.yml up -d

db-down:
	docker compose -f docker/postgres.yml down

db-reset:
	docker compose -f docker/postgres.yml down -v
	docker compose -f docker/postgres.yml up -d
