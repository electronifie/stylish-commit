run:
	./bin/stylish-commit

test:
	npm test

install-precommit:
	./bin/stylish-commit --install-hook

uninstall-precommit:
	./bin/stylish-commit --uninstall-hook

.PHONY: test
