//exemple format du payload de mutation de lomkit/laravel-rest-api

import { ca } from 'vuetify/locale'

// (POST) api/users/mutate
const eg = {
    mutate: [
        {
            operation: 'create',
            attributes: { name: 'test', email: 'uniq4@uniq.fr', password: 'hidden' },
            relations: {
                star: {
                    operation: 'create',
                    attributes: { number: 2 },
                },
            },
        },
        {
            operation: 'create',
            attributes: { name: 'test2', email: 'uniq5@uniq.fr', password: 'hidden' },
            relations: {
                star: {
                    operation: 'attach',
                    key: [1, 2],
                },
            },
        },
        {
            operation: 'update',
            key: 2,
            attributes: {},
            relations: {
                star: {
                    operation: 'detach',
                    key: 1,
                },
            },
        },
        {
            operation: 'create',
            attributes: { name: 'test2', email: 'uniq6@uniq.fr', password: 'hidden' },
            relations: {
                posts: [
                    {
                        operation: 'sync',
                        without_detaching: true,
                        key: 1,
                        attributes: { number: 4 },
                        pivot: { color: '#2271B3' },
                    },
                    {
                        operation: 'toggle',
                        key: 2,
                        attributes: { number: 4 },
                        pivot: { color: '#C51D34' },
                    },
                ],
            },
        },
        {
            operation: 'update',
            key: 1,
            attributes: { name: 'new name :)' },
            relations: {
                posts: [
                    {
                        operation: 'create',
                        attributes: {},
                        relations: {
                            star: {
                                operation: 'create',
                                attributes: { number: 2 },
                            },
                        },
                    },
                    {
                        operation: 'detach',
                        key: 2,
                    },
                ],
            },
        },
    ],
}

const User = {} // a remplacer par un model
const Post = {} // a remplacer par un model
const Category = {} // a remplacer par un model

const users = await User.getPage(1)
const posts = await Post.getPage(1)
const category = await Category.find(1)
const newCategory = Category.create({ name: 'New Category' })

const newPost = Post.create({ title: 'New Post' })

const deletedPost = posts[1]
deletedPost.delete()
//ou
Post.delete(1)

const draftPost = posts[2]
draftPost.name = 'Draft Post'

// mutation relation multiple
users[0].posts.attach(posts[0]) // on ne peut pas attacher un post qui n'existe pas encore ou qui est delete(remonte une erreur) sinon on ajoute un payload de relation attach ou update selon le status du model
//ou
users[0].posts.attach(posts[0].id) // si on attache par la cle primaire alors on ajoute un payload de relation attach, mais on enleve l'ancienne relation si l'attach reussi, sinon on ajoute un payload de relation attach ou update selon le status du model
//avant mutation, on check les conditions sinon erreur
//apres mutation on applique les changments front si la mutation reussi sauf si attach par cle primaire, sinon on ne change rien et on affiche une erreur

users[0].posts.detach(posts[0]) // ajoute payload de relation detach , et on ne peut pas détacher un post qui n'existe pas encore
//avant mutation, on check les conditions sinon erreur
//apres mutation on applique les changments front si la mutation reussi sinon on ne change rien et on affiche une erreur

users[0].posts[0].name = 'Updated Post' //passe le model en draft, construit un payload de relation update
//ou
posts[120].name = 'Updated Post' //passe le model en draft, construit un payload de relation update
users[0].posts.attach(posts[120]) //passe le model en draft, construit un payload de relation update
//avant mutation, on check les conditions sinon erreur, ca fera une mutation update si le model est en draft
//apres mutation on applique les changments front si la mutation reussi sinon on ne change rien et on affiche une erreur

users[0].posts.sync(posts[0], { withoutDetaching: true }) //ne peut pas etre draft ni deleted, ajoute un payload de relation sync avec l'option withoutDetaching ou non
users[0].posts.create({ title: 'New Post' }) // ajoute payload de relation create

// mutation relation simple
posts[0].category.attach(1) // si on attache par la cle primaire alors on ajoute un payload de relation attach, mais on enleve l'ancienne relation si l'attach reussi, sinon on ajoute un payload de relation attach ou update selon le status du model
posts[0].category.detach()
posts[0].category.sync()
posts[0].category.toggle(category) // si la category est attaché alors detach sinon attach (gere par lomkit/laravel-rest-api), si on toggle par la cle primaire alors on ajoute un payload de relation attach ou detach selon le status de la relation, sinon on ajoute un payload de relation attach ou update selon le status du model
posts[0].category.create({ name: 'New Category' })

posts[0].save()

//exemple de recursivite
users[0].posts[0].category.create({ name: 'New Category' }) // ajoute un payload de relation create pour la category, puis un payload de relation create pour le post, puis un payload de relation attach pour le post et la category
//ou
users[0].posts[0].category.name = 'Updated Category' // ajoute un payload de relation attach pour la category, puis un payload de relation update pour le post, puis un payload de relation attach pour le post et la category

//d'autres examples genere par l'ia
