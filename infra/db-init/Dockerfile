FROM postgres:16-alpine

RUN apk add --no-cache bash

WORKDIR /db-init
COPY ./init.sh /db-init/init.sh
COPY ./migrations /db-init/migrations
RUN chmod +x /db-init/init.sh

ENTRYPOINT ["/db-init/init.sh"]
