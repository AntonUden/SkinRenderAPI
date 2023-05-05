import HTTP from "http";
import Express from "express";
import sharp, { kernel } from 'sharp'
import axios from 'axios'
import { setCorsHeaders } from "./cors/CorsMiddleware";
import IConfiguration from "./IConfiguration";

export default class SkinRenderServer {
	private express: Express.Express;
	private http: HTTP.Server;

	constructor(config: IConfiguration) {
		this.express = Express();
		this.express.set("port", config.port);

		this.express.disable('x-powered-by');
		this.express.use('/', Express.static(__dirname + '/../index'));
		this.express.use(setCorsHeaders);
		this.express.use(require("morgan")("combined"));

		this.http = new HTTP.Server(this.express);

		this.express.get(["/from_image/face/*", "/from_image/face"], async (req: Express.Request, res: Express.Response) => {
			let resolution: number = 64;

			if (req.query.resolution != null) {
				resolution = parseInt("" + req.query.resolution);
				if (isNaN(resolution)) {
					resolution = 64;
				}

				if (resolution > 1024) {
					resolution = 1024;
				}

				if (resolution < 8) {
					resolution = 8;
				}
			}

			try {
				const url: string = "" + req.query.url;
				res.setHeader('Content-Type', 'image/png');

				console.log("Request with url: " + url);

				if (!/^https{0,1}:\/\/.+$/.test(url)) {
					res.statusCode = 400;
					res.set("x-error", "The provided url has an invalid format");
					res.set('Cache-Control', `public, max-age=3600`);
					res.send(await this.createErrorImage(resolution));
					return;
				}

				const imageResponse = await axios.get(url, { responseType: 'arraybuffer' })
				if (!imageResponse.headers['content-type'].startsWith('image/')) {
					res.statusCode = 400;
					res.set("x-error", "URL Does not contain a valid image");
					res.set('Cache-Control', `public, max-age=3600`);
					res.send(await this.createErrorImage(resolution))
					return
				}

				const image = sharp(imageResponse.data)
				const metadata = await image.metadata()

				if (metadata.width === 64 && (metadata.height === 64 || metadata.height === 32)) {
					const isSlim = metadata.height === 64;
					const manipulatedImageBuffer = await this.manipulateImage(imageResponse.data, 8, 8, 8, 8, isSlim, 40, 8, 8, 8, resolution)
					res.set('Cache-Control', `public, max-age=3600`);
					return res.send(manipulatedImageBuffer)
				} else {
					res.statusCode = 400;
					res.set("x-error", "Image is not a valid skin");
					res.set('Cache-Control', `public, max-age=3600`);
					res.send(await this.createErrorImage(resolution))
					return;
				}
			} catch (error) {
				res.statusCode = 400;
				res.set("x-error", "Invalid URL");
				res.set('Cache-Control', `public, max-age=3600`);
				res.send(await this.createErrorImage(resolution))
				return;
			}
		});

		this.http.listen(config.port, function () {
			console.log("Listening on port: " + config.port);
		});
	}

	private async createErrorImage(resolution: number) {
		return await sharp(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsQAAA7EAZUrDhsAAADTSURBVBhXAcgAN/8BMiMQAgEBCQUDAgEBAAAA/v//9/v9+Pv9Aw8KAgwJCAQEBAkGBgUDA/0AAQoFBP3+/gE+KhdRMi0YFRMFCAr8+ff4+frt8fG309gDeE0+GxsdAgAFBQH9/f3+AAEIFBQSHw4LAhcZGjFWbMjjI+7y+uvt9c3nJzFUahYWFwNGKBvt3dMK/+LX3uDw9PQnGPfv3s/w7ewDQyka7fHsx9HUCQMG/Pr80drWCggA8/j4AgED/vP2+vDy89zo49rl4Pn9/PX4+wgGAoI8XTMpMeNbAAAAAElFTkSuQmCC", "base64"))
			.resize(null, resolution, {
				kernel: kernel.nearest
			})
			.png()
			.toBuffer()
	}

	private async manipulateImage(imageBuffer: any, x1: number, y1: number, width1: number, height1: number, isSlim: boolean, x2: number, y2: number, width2: number, height2: number, resolution: number) {
		const image = sharp(imageBuffer)

		const part1 = await image.clone().extract({ left: x1, top: y1, width: width1, height: height1 }).resize(null, resolution, {
			kernel: kernel.nearest
		}).toBuffer()

		const baseImage = sharp(part1)

		let result = baseImage;
		if (isSlim) {
			const part2 = await image.clone().extract({ left: x2, top: y2, width: width2, height: height2 }).resize(null, resolution, {
				kernel: kernel.nearest
			}).toBuffer()
			result = result.composite([{ input: part2, left: 0, top: 0 }]);
		}

		// Place the second part on top of the first part
		const manipulatedImage = await result
			.png()
			.toBuffer()

		return manipulatedImage
	}
}