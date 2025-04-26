# Discord Userdoccer OpenAPI Specification

This API contains a modified version of the [Discord OpenAPI Spec](github.com/discord/discord-api-spec).

> Please note, this repo only contains the modified `openapi_preview.json`, not `openapi.json`.


## Getting Started

To get started, install [Bun](https://bun.sh/).

To get started editing the OpenAPI schema, run `bun prep`.
This will generate a `specs/openapi_preview.modified.json` file which you should edit.

## Generating your patch file

After you edit this file in whatever tool you prefer, you can run `bun generate-patch` to automatically convert your changes into a JSON patch. This will be written to `patches/__new_patch.json`.

## Generating the final schema

You can rename this, or move the patches into an existing file, and then run `bun generate-schema` to write the final schema to `generated/openapi_preview.json`.


If all goes well, the `generated/openapi_preview.json` should include your changes! Check your git diff to validate the changes are correct.

## Contributing

Run `bun format` to make sure your changes project follows our standard style.

Finally, open a PR with a quick summary of your changes!


## Quirks

This project uses the `JSON Patch` [RFC 6902](https://datatracker.ietf.org/doc/html/rfc6902/).

Let's say you have an object like so:

```json
{
    "paths": {
        "/users/@me": {
            "get": { ... }
        }
    }
}
```

In order to access the `get` property, your path would need to look like this:

```json
{ "path": "/paths/~1users~1@me/get", ... }
```

This is because, in JSON Patch files, to escape a `~`, you need to use `~0`, and to escape a `/`, you need to use `~1`.

This will be automatically handled by the code generator, so you only need to worry about this if you're writing patches by hand.
