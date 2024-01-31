package main

import (
	"log"
	"os"
	"path"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/template/mustache/v2"
	"github.com/google/uuid"
)

func main() {
	stat, err := os.Stat("./data")
	if err != nil {
		if os.IsNotExist(err) {
			err := os.Mkdir("./data", 0755)
			if err != nil {
				log.Fatal(err)
			}
		} else {
			log.Fatal(err)
		}
	} else if !stat.IsDir() {
		log.Fatal("./data is not a directory")
	}

	// Create a new engine
	engine := mustache.New("./views", ".mustache")

	// Configure the fiber application.
	app := fiber.New(fiber.Config{
		// Limit the size of the body to 500MB.
		BodyLimit: 500 * 1024 * 1024,

		// Use the HTML template engine.
		Views: engine,
	})

	// Configure the static file server for all assets.
	app.Static("/assets", "./public")

	// Global middlware.
	app.Use(cors.New())
	app.Use(logger.New())

	app.Get("/", func(c *fiber.Ctx) error {
		return c.Render("login", fiber.Map{}, "layouts/main")
	})

	app.Get("/files/:fingerprint", func(c *fiber.Ctx) error {
		fingerprint := c.Cookies("fingerprint")
		if fingerprint == "" {
			return c.Redirect("/")
		}
		if fingerprint != c.Params("fingerprint") {
			return c.SendStatus(401)
		}

		return c.Render("files", fiber.Map{"loggedIn": true}, "layouts/main")
	})

	app.Post("/login", func(c *fiber.Ctx) error {
		log.Println(string(c.Body()))

		fingerprint := c.FormValue("fingerprint")
		if fingerprint == "" {
			fingerprint = uuid.NewString()
		}

		_, err := os.Stat(path.Join("./data", fingerprint))
		if os.IsNotExist(err) {
			err = os.Mkdir(path.Join("./data", fingerprint), 0755)
			if err != nil {
				return err
			}
		}
		if err != nil {
			return err
		}

		c.Cookie(&fiber.Cookie{
			Name:     "fingerprint",
			Value:    fingerprint,
			HTTPOnly: true,
			Secure:   true,
			SameSite: "Strict",
		})

		return c.Redirect("/files/" + fingerprint)
	})

	app.Get("/logout", func(c *fiber.Ctx) error {
		c.ClearCookie("fingerprint")
		return c.Redirect("/")
	})

	app.Post("/upload/:name", func(c *fiber.Ctx) error {
		fingerprint := c.Cookies("fingerprint")

		if fingerprint == "" {
			return c.Status(401).JSON(fiber.Map{"error": "not logged in"})
		}

		_, err := os.Stat(path.Join("./data", fingerprint))
		if os.IsNotExist(err) {
			return c.Status(401).JSON(fiber.Map{"error": "not logged in"})
		}

		name := c.Params("name")
		if name == "" {
			return c.Status(400).JSON(fiber.Map{"error": "missing name"})
		}

		err = os.WriteFile(path.Join("./data", fingerprint, name), c.Body(), 0644)
		if err != nil {
			return err
		}

		return c.JSON(fiber.Map{"ok": true})
	})

	app.Get("/download/:name", func(c *fiber.Ctx) error {
		fingerprint := c.Cookies("fingerprint")
		if fingerprint == "" {
			return c.Status(401).JSON(fiber.Map{"error": "not logged in"})
		}

		_, err := os.Stat(path.Join("./data", fingerprint))
		if err != nil {
			return err
		}

		name := c.Params("name")
		if name == "" {
			return c.Status(400).JSON(fiber.Map{"error": "missing name"})
		}

		contents, err := os.ReadFile(path.Join("./data", fingerprint, name))
		if err != nil {
			return err
		}

		return c.Send(contents)
	})

	app.Post("/delete/:name", func(c *fiber.Ctx) error {
		fingerprint := c.Cookies("fingerprint")

		if fingerprint == "" {
			return c.Status(401).JSON(fiber.Map{"error": "not logged in"})
		}

		_, err := os.Stat(path.Join("./data", fingerprint))
		if os.IsNotExist(err) {
			return c.Status(401).JSON(fiber.Map{"error": "not logged in"})
		}

		name := c.Params("name")
		if name == "" {
			return c.Status(400).JSON(fiber.Map{"error": "missing name"})
		}

		err = os.Remove(path.Join("./data", fingerprint, name))
		if err != nil {
			return err
		}

		return c.JSON(fiber.Map{"ok": true})
	})

	app.Get("/download/:name", func(c *fiber.Ctx) error {
		fingerprint := c.Cookies("fingerprint")
		if fingerprint == "" {
			return c.Status(401).JSON(fiber.Map{"error": "not logged in"})
		}

		_, err := os.Stat(path.Join("./data", fingerprint))
		if err != nil {
			return err
		}

		name := c.Params("name")
		if name == "" {
			return c.Status(400).JSON(fiber.Map{"error": "missing name"})
		}

		contents, err := os.ReadFile(path.Join("./data", fingerprint, name))
		if err != nil {
			return err
		}

		return c.Send(contents)
	})

	log.Fatal(app.ListenTLS(":8080", "cert.pem", "key.pem"))
}

type NewConnectionDTO struct {
	Fingerprint string `json:"fingerprint"`
}
