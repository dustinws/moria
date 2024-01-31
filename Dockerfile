FROM golang:1.21-alpine AS builder

WORKDIR /app

COPY go.mod go.sum ./

RUN go mod download

COPY . .

RUN go build -o main main.go

FROM alpine:3.18

RUN apk update && apk add --no-cache openssl
RUN openssl req -x509 -newkey rsa:4096 -keyout /root/key.pem -out /root/cert.pem -days 365 -nodes -subj '/CN=localhost'

RUN apk --no-cache add ca-certificates

WORKDIR /root/

COPY --from=builder /app/public/ ./public/
COPY --from=builder /app/views/ ./views/
COPY --from=builder /app/main .

CMD ["./main"]