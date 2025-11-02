<!-- $header -->
Title: "Title"
Description: "Description"
ImageURL: "image"
 
<!-- $/header -->

<!-- 
URL & ImageURL will be appended to the root of the domain 
    (ImageURL -> granth.one/public/posts/image) <- /public/posts/ will be prepended to image url  
    (URL -> granth.one/posts/2025/url) <- 2025 is the folder and will be prepended to url
-->

# Example Header
<img src="imageurl"> <!-- again, /public/posts/image will be prepended to src -->
<a href="url"></a> <!-- but this will not be changed at all -->

## Example Subheader
<!-- HTML content will be respected -->
This is some content <br>

This is some more content
<div>
</div>

